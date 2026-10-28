import { EventEmitter } from 'node:events';

/**
 * In-memory stand-in for Redis, for local development without Docker (`REDIS_URL=memory`).
 *
 * Implements only the commands FieldTrace uses (strings with NX/EX/PX, hashes, sorted-set
 * scores, GEOADD, the live-position Lua script, a SET pipeline and SCAN). State lives in this
 * process: it is lost on restart and NOT shared between instances, so it is refused in
 * production (see lib/redis.ts).
 */
export class InMemoryRedis extends EventEmitter {
  public status = 'ready';
  private readonly keyPrefix: string;
  private readonly strings = new Map<string, { value: string; expiresAt?: number }>();
  private readonly hashes = new Map<string, Map<string, string>>();
  private readonly zsets = new Map<string, Map<string, number>>();
  private readonly geos = new Map<string, Map<string, { lng: number; lat: number }>>();

  constructor(keyPrefix = '') {
    super();
    this.keyPrefix = keyPrefix;
  }

  private fullKey(key: string): string {
    if (!this.keyPrefix) return key;
    return key.startsWith(this.keyPrefix) ? key : `${this.keyPrefix}${key}`;
  }

  private liveString(k: string) {
    const item = this.strings.get(k);
    if (item?.expiresAt !== undefined && item.expiresAt <= Date.now()) {
      this.strings.delete(k);
      return undefined;
    }
    return item;
  }

  private hashFor(k: string): Map<string, string> {
    let hash = this.hashes.get(k);
    if (!hash) {
      hash = new Map();
      this.hashes.set(k, hash);
    }
    return hash;
  }

  // ------------------------------------------------------------ hashes

  hget(key: string, field: string): Promise<string | null> {
    return Promise.resolve(this.hashes.get(this.fullKey(key))?.get(String(field)) ?? null);
  }

  hset(key: string, ...args: (string | number)[]): Promise<number> {
    const hash = this.hashFor(this.fullKey(key));
    let added = 0;
    for (let i = 0; i + 1 < args.length; i += 2) {
      const field = String(args[i]);
      if (!hash.has(field)) added++;
      hash.set(field, String(args[i + 1]));
    }
    return Promise.resolve(added);
  }

  hdel(key: string, ...fields: string[]): Promise<number> {
    const hash = this.hashes.get(this.fullKey(key));
    if (!hash) return Promise.resolve(0);
    return Promise.resolve(fields.filter((field) => hash.delete(String(field))).length);
  }

  hgetall(key: string): Promise<Record<string, string>> {
    const hash = this.hashes.get(this.fullKey(key));
    return Promise.resolve(hash ? Object.fromEntries(hash) : {});
  }

  hmget(key: string, ...fields: string[]): Promise<(string | null)[]> {
    const hash = this.hashes.get(this.fullKey(key));
    return Promise.resolve(fields.map((field) => hash?.get(String(field)) ?? null));
  }

  // ------------------------------------------------------------ sorted sets / geo

  zscore(key: string, member: string): Promise<string | null> {
    const score = this.zsets.get(this.fullKey(key))?.get(String(member));
    return Promise.resolve(score === undefined ? null : String(score));
  }

  zmscore(key: string, ...members: string[]): Promise<(string | null)[]> {
    const zset = this.zsets.get(this.fullKey(key));
    return Promise.resolve(
      members.map((member) => {
        const score = zset?.get(String(member));
        return score === undefined ? null : String(score);
      }),
    );
  }

  zadd(key: string, score: string | number, member: string): Promise<number> {
    const k = this.fullKey(key);
    let zset = this.zsets.get(k);
    if (!zset) {
      zset = new Map();
      this.zsets.set(k, zset);
    }
    const isNew = !zset.has(String(member));
    zset.set(String(member), Number(score));
    return Promise.resolve(isNew ? 1 : 0);
  }

  geoadd(key: string, lng: string | number, lat: string | number, member: string): Promise<number> {
    const k = this.fullKey(key);
    let geo = this.geos.get(k);
    if (!geo) {
      geo = new Map();
      this.geos.set(k, geo);
    }
    const isNew = !geo.has(String(member));
    geo.set(String(member), { lng: Number(lng), lat: Number(lat) });
    return Promise.resolve(isNew ? 1 : 0);
  }

  // ------------------------------------------------------------ strings

  /** Supports `NX`, `EX seconds` and `PX milliseconds`. */
  set(key: string, value: string, ...args: (string | number)[]): Promise<'OK' | null> {
    const k = this.fullKey(key);
    let ttlMs: number | undefined;
    let onlyIfAbsent = false;
    for (let i = 0; i < args.length; i++) {
      const arg = String(args[i]).toUpperCase();
      if (arg === 'NX') onlyIfAbsent = true;
      else if (arg === 'EX' && i + 1 < args.length) ttlMs = Number(args[++i]) * 1000;
      else if (arg === 'PX' && i + 1 < args.length) ttlMs = Number(args[++i]);
    }
    if (onlyIfAbsent && this.liveString(k)) return Promise.resolve(null);
    this.strings.set(k, {
      value: String(value),
      ...(ttlMs !== undefined ? { expiresAt: Date.now() + ttlMs } : {}),
    });
    return Promise.resolve('OK');
  }

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.liveString(this.fullKey(key))?.value ?? null);
  }

  del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      const k = this.fullKey(key);
      for (const store of [this.strings, this.hashes, this.zsets, this.geos]) {
        if (store.delete(k)) count++;
      }
    }
    return Promise.resolve(count);
  }

  /** Only `set` is pipelined by FieldTrace (sample de-duplication). */
  pipeline() {
    const commands: (() => Promise<unknown>)[] = [];
    const pipe = {
      set: (key: string, value: string, ...args: (string | number)[]) => {
        commands.push(() => this.set(key, value, ...args));
        return pipe;
      },
      exec: async (): Promise<[Error | null, unknown][]> => {
        const results: [Error | null, unknown][] = [];
        for (const command of commands) {
          try {
            results.push([null, await command()]);
          } catch (error) {
            results.push([error as Error, null]);
          }
        }
        return results;
      },
    };
    return pipe;
  }

  /**
   * Only the live-position "save if newer" script is supported (keys: lastSeen zset, latest
   * hash, geo; args: agentId, recordedAt, fix JSON, lng, lat). Anything else is a programming
   * error and throws instead of silently pretending to succeed.
   */
  async eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<number> {
    if (!script.includes("redis.call('ZSCORE'")) {
      throw new Error('InMemoryRedis.eval: unsupported Lua script');
    }
    const [lastSeenKey, latestKey, geoKey] = args.slice(0, numKeys).map(String) as [
      string,
      string,
      string,
    ];
    const [agentId, recordedAt, fixJson, lng, lat] = args.slice(numKeys).map(String) as [
      string,
      string,
      string,
      string,
      string,
    ];
    const previous = await this.zscore(lastSeenKey, agentId);
    if (previous !== null && Number(previous) >= Number(recordedAt)) return 0;
    await this.zadd(lastSeenKey, recordedAt, agentId);
    await this.hset(latestKey, agentId, fixJson);
    await this.geoadd(geoKey, lng, lat, agentId);
    return 1;
  }

  /** Single batch of matching keys (`*` wildcard only). */
  *scanStream(options?: { match?: string; count?: number }): Generator<string[]> {
    const pattern = options?.match;
    const regex = pattern
      ? new RegExp(`^${pattern.replace(/[-[\]{}()+?.,\\^$|#\s]/g, '\\$&').replace(/\*/g, '.*')}$`)
      : null;
    const keys = new Set<string>([
      ...this.strings.keys(),
      ...this.hashes.keys(),
      ...this.zsets.keys(),
      ...this.geos.keys(),
    ]);
    const matched = [...keys].filter((key) => !regex || regex.test(key));
    if (matched.length > 0) yield matched;
  }

  quit(): Promise<'OK'> {
    this.status = 'end';
    return Promise.resolve('OK');
  }

  disconnect(): void {
    this.status = 'end';
  }
}
