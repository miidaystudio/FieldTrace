import { conflict, forbidden, notFound } from '../../lib/errors.js';
import { escapeRegex, pageMeta, skipFor, toMongoSort } from '../../lib/pagination.js';
import { idString, isoOrNull, toObjectId } from '../../shared/schemas.js';
import type { Actor } from '../../shared/types.js';
import { diffFields, recordAudit } from '../audit/audit.service.js';
import { hashPassword } from '../auth/password.js';
import { revokeUserSessions } from '../auth/session.service.js';
import { User, type UserDoc } from './user.model.js';
import type { CreateUserBody, ListUsersQuery, UpdateUserBody, UserDto } from './user.schemas.js';

export function toUserDto(doc: UserDoc): UserDto {
  return {
    id: idString(doc._id),
    orgId: idString(doc.orgId),
    name: doc.name,
    email: doc.email,
    role: doc.role,
    status: doc.status,
    mustChangePassword: doc.mustChangePassword,
    lastLoginAt: isoOrNull(doc.lastLoginAt),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function assertEmailAvailable(email: string): Promise<void> {
  const existing = await User.exists({ email }).setOptions({ skipTenantCheck: true });
  if (existing) throw conflict('An account with this email already exists');
}

async function findUserOrThrow(actor: Actor, id: string) {
  const user = await User.findOne({ _id: id, orgId: actor.orgId });
  if (!user) throw notFound('User');
  return user;
}

async function assertNotLastActiveAdmin(actor: Actor, userId: string): Promise<void> {
  const otherAdmins = await User.countDocuments({
    orgId: actor.orgId,
    role: 'admin',
    status: 'active',
    _id: { $ne: userId },
  });
  if (otherAdmins === 0) throw conflict('An organization must keep at least one active admin');
}

export async function listUsers(actor: Actor, query: ListUsersQuery) {
  const filter: Record<string, unknown> = { orgId: toObjectId(actor.orgId) };
  if (query.role) filter.role = { $in: query.role };
  if (query.status) filter.status = { $in: query.status };
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }];
  }
  const [docs, total] = await Promise.all([
    User.find(filter)
      .sort(toMongoSort(query.sort))
      .skip(skipFor(query.page, query.limit))
      .limit(query.limit)
      .lean(),
    User.countDocuments(filter),
  ]);
  return { data: docs.map(toUserDto), meta: pageMeta(query.page, query.limit, total) };
}

export async function getUser(actor: Actor, id: string): Promise<UserDto> {
  const user = await User.findOne({ _id: id, orgId: actor.orgId }).lean();
  if (!user) throw notFound('User');
  return toUserDto(user);
}

export async function createUser(actor: Actor, body: CreateUserBody): Promise<UserDto> {
  await assertEmailAvailable(body.email);
  const user = await User.create({
    orgId: actor.orgId,
    name: body.name,
    email: body.email,
    role: body.role,
    passwordHash: await hashPassword(body.temporaryPassword),
    mustChangePassword: true,
  });
  await recordAudit(actor, {
    action: 'user.created',
    entityType: 'user',
    entityId: user._id,
    metadata: { role: user.role, email: user.email },
  });
  return toUserDto(user.toObject());
}

export async function updateUser(actor: Actor, id: string, body: UpdateUserBody): Promise<UserDto> {
  const user = await findUserOrThrow(actor, id);
  const before = user.toObject();

  if (body.role !== undefined && body.role !== user.role) {
    if (user.role === 'agent') {
      throw conflict('Agent accounts cannot change role; create a separate staff account');
    }
    if (idString(user._id) === actor.userId) throw forbidden('You cannot change your own role');
    if (user.role === 'admin' && user.status === 'active') {
      await assertNotLastActiveAdmin(actor, id);
    }
    user.role = body.role;
  }
  if (body.name !== undefined) user.name = body.name;
  await user.save();

  const changes = diffFields(before, user.toObject(), ['name', 'role']);
  if (changes.role) {
    await recordAudit(actor, {
      action: 'user.role_changed',
      entityType: 'user',
      entityId: user._id,
      changes,
    });
  } else if (Object.keys(changes).length > 0) {
    await recordAudit(actor, {
      action: 'user.updated',
      entityType: 'user',
      entityId: user._id,
      changes,
    });
  }
  return toUserDto(user.toObject());
}

export async function setUserStatus(
  actor: Actor,
  id: string,
  status: 'active' | 'deactivated',
): Promise<UserDto> {
  const user = await findUserOrThrow(actor, id);
  if (user.status === status) return toUserDto(user.toObject());

  if (status === 'deactivated') {
    if (idString(user._id) === actor.userId) throw forbidden('You cannot deactivate yourself');
    if (user.role === 'admin') await assertNotLastActiveAdmin(actor, id);
  }

  user.status = status;
  await user.save();
  if (status === 'deactivated') await revokeUserSessions(actor.orgId, user._id, 'user_deactivated');

  await recordAudit(actor, {
    action: status === 'deactivated' ? 'user.deactivated' : 'user.reactivated',
    entityType: 'user',
    entityId: user._id,
    changes: { status: { from: status === 'active' ? 'deactivated' : 'active', to: status } },
  });
  return toUserDto(user.toObject());
}

export async function resetUserPassword(
  actor: Actor,
  id: string,
  temporaryPassword: string,
): Promise<void> {
  const user = await findUserOrThrow(actor, id);
  if (idString(user._id) === actor.userId) {
    throw forbidden('Use /auth/change-password to change your own password');
  }
  user.passwordHash = await hashPassword(temporaryPassword);
  user.mustChangePassword = true;
  await user.save();
  await revokeUserSessions(actor.orgId, user._id, 'password_reset');
  await recordAudit(actor, {
    action: 'user.password_reset',
    entityType: 'user',
    entityId: user._id,
  });
}
