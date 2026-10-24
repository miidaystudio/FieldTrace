import { EventEmitter } from 'node:events';

/**
 * In-memory fallback for Redis.
 *
 * Implements the Redis commands used by FieldTrace (hashes, sorted sets, geo metadata,
 * TTL keys with NX, and Lua evaluation for atomic fix ingestion) without needing
 * an external Redis server or Docker.
 */
export class InMemoryRedis extends EventEmitter {
  public status: string = 'ready';
  private keyPrefix: string;
  private strings = new Map<string, { value: string; expiresAt?: number }>();
  private hashes = new Map<string, Map<string, string>>();
  private zsets = new Map<string, Map<string, number>>();
  private geos = new Map<string, Map<string, { lng: number; lat: number }>>();

  constructor(keyPrefix = '') {
    super();
    this.keyPrefix = keyPrefix;
  }

  private fullKey(key: string): string {
    if (!this.keyPrefix) return key;
    return key.startsWith(this.keyPrefix) ? key : `${this.keyPrefix}${key}`;
  }

  private cleanExpired(k: string) {
    const item = this.strings.get(k);
    if (item && item.expiresAt && item.expiresAt <= Date.now()) {
      this.strings.delete(k);
      return null;
    }
    return item;
  }

  async hget(key: string, field: string): Promise<string | null> {
    const k = this.fullKey(key);
    const hash = this.hashes.get(k);
    return hash?.get(String(field)) ?? null;
  }

  async hset(key: string, ...args: (string | number)[]): Promise<number> {
    const k = this.fullKey(key);
    let hash = this.hashes.get(k);
    if (!hash) {
      hash = new Map();
      this.hashes.set(k, hash);
    }
    let count = 0;
    if (args.length === 2) {
      const field = String(args[0]);
      const value = String(args[1]);
      if (!hash.has(field)) count++;
      hash.set(field, value);
    } else {
      for (let i = 0; i < args.length; i += 2) {
        if (i + 1 < args.length) {
          const field = String(args[i]);
          const value = String(args[i + 1]);
          if (!hash.has(field)) count++;
          hash.set(field, value);
        }
      }
    }
    return count;
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    const k = this.fullKey(key);
    const hash = this.hashes.get(k);
    if (!hash) return 0;
    let deleted = 0;
    for (const f of fields) {
      if (hash.delete(String(f))) deleted++;
    }
    return deleted;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const k = this.fullKey(key);
    const hash = this.hashes.get(k);
    if (!hash) return {};
    const result: Record<string, string> = {};
    for (const [field, val] of hash.entries()) {
      result[field] = val;
    }
    return result;
  }

  async hmget(key: string, ...fields: string[]): Promise<(string | null)[]> {
    const k = this.fullKey(key);
    const hash = this.hashes.get(k);
    return fields.map((f) => hash?.get(String(f)) ?? null);
  }

  async zscore(key: string, member: string): Promise<string | null> {
    const k = this.fullKey(key);
    const zset = this.zsets.get(k);
    const score = zset?.get(String(member));
    return score !== undefined ? String(score) : null;
  }

  async zmscore(key: string, ...members: string[]): Promise<(string | null)[]> {
    const k = this.fullKey(key);
    const zset = this.zsets.get(k);
    return members.map((m) => {
      const score = zset?.get(String(m));
      return score !== undefined ? String(score) : null;
    });
  }

  async zadd(key: string, score: string | number, member: string): Promise<number> {
    const k = this.fullKey(key);
    let zset = this.zsets.get(k);
    if (!zset) {
      zset = new Map();
      this.zsets.set(k, zset);
    }
    const isNew = !zset.has(String(member));
    zset.set(String(member), Number(score));
    return isNew ? 1 : 0;
  }

  async geoadd(key: string, lng: string | number, lat: string | number, member: string): Promise<number> {
    const k = this.fullKey(key);
    let geo = this.geos.get(k);
    if (!geo) {
      geo = new Map();
      this.geos.set(k, geo);
    }
    const isNew = !geo.has(String(member));
    geo.set(String(member), { lng: Number(lng), lat: Number(lat) });
    return isNew ? 1 : 0;
  }

  async set(key: string, value: string, ...args: any[]): Promise<'OK' | null> {
    const k = this.fullKey(key);
    let ttlMs: number | undefined;
    let isNx = false;

    for (let i = 0; i < args.length; i++) {
      const arg = String(args[i]).toUpperCase();
      if (arg === 'NX') {
        isNx = true;
      } else if (arg === 'EX' && i + 1 < args.length) {
        ttlMs = Number(args[i + 1]) * 1000;
        i++;
      } else if (arg === 'PX' && i + 1 < args.length) {
        ttlMs = Number(args[i + 1]);
        i++;
      }
    }

    if (isNx) {
      const existing = this.cleanExpired(k);
      if (existing !== null && existing !== undefined) {
        return null;
      }
    }

    const expiresAt = ttlMs !== undefined ? Date.now() + ttlMs : undefined;
    this.strings.set(k, { value: String(value), expiresAt });
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    const k = this.fullKey(key);
    const item = this.cleanExpired(k);
    return item ? item.value : null;
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      const k = this.fullKey(key);
      if (this.strings.delete(k)) count++;
      if (this.hashes.delete(k)) count++;
      if (this.zsets.delete(k)) count++;
      if (this.geos.delete(k)) count++;
    }
    return count;
  }

  pipeline() {
    const commands: Array<() => Promise<any>> = [];
    const self = this;
    return {
      set(key: string, value: string, ...args: any[]) {
        commands.push(() => self.set(key, value, ...args));
        return this;
      },
      async exec(): Promise<[Error | null, any][]> {
        const results: [Error | null, any][] = [];
        for (const cmd of commands) {
          try {
            const res = await cmd();
            results.push([null, res]);
          } catch (err: any) {
            results.push([err, null]);
          }
        }
        return results;
      },
    };
  }

  async eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<any> {
    if (script.includes('ZSCORE') || script.includes('SAVE_IF_NEWER')) {
      const keys = args.slice(0, numKeys).map(String);
      const argVals = args.slice(numKeys).map(String);
      const lastSeenKey = keys[0]!;
      const latestKey = keys[1]!;
      const geoKey = keys[2]!;
      const agentId = argVals[0]!;
      const recordedAt = Number(argVals[1]!);
      const fixJson = argVals[2]!;
      const lng = Number(argVals[3]!);
      const lat = Number(argVals[4]!);

      const prevScore = await this.zscore(lastSeenKey, agentId);
      if (prevScore !== null && Number(prevScore) >= recordedAt) {
        return 0;
      }
      await this.zadd(lastSeenKey, recordedAt, agentId);
      await this.hset(latestKey, agentId, fixJson);
      await this.geoadd(geoKey, lng, lat, agentId);
      return 1;
    }
    return 1;
  }

  async *scanStream(opts?: { match?: string; count?: number }) {
    const match = opts?.match;
    const regex = match
      ? new RegExp('^' + match.replace(/[-[\]{}()+?.,\\^$|#\s]/g, '\\$&').replace(/\*/g, '.*') + '$')
      : null;

    const allKeys = new Set<string>([
      ...this.strings.keys(),
      ...this.hashes.keys(),
      ...this.zsets.keys(),
      ...this.geos.keys(),
    ]);

    const matched: string[] = [];
    for (const key of allKeys) {
      if (!regex || regex.test(key)) {
        matched.push(key);
      }
    }
    if (matched.length > 0) {
      yield matched;
    }
  }

  async quit(): Promise<'OK'> {
    this.status = 'end';
    return 'OK';
  }

  async disconnect(): Promise<void> {
    this.status = 'end';
  }
}
