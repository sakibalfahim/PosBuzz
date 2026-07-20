export interface TokenRevocationStore {
  revoke(jti: string, ttlSeconds: number): Promise<void>;
  isRevoked(jti: string): Promise<boolean>;
}

export interface IdempotencyStore {
  /** SET key value NX EX ttl. Returns true if key was set (first request). */
  claim(key: string, saleId: string, ttlSeconds: number): Promise<boolean>;
  /** Unconditional SET EX (overwrite placeholder with real sale id). */
  set(key: string, saleId: string, ttlSeconds: number): Promise<void>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<void>;
}

export const TOKEN_REVOCATION_STORE = Symbol('TOKEN_REVOCATION_STORE');
export const IDEMPOTENCY_STORE = Symbol('IDEMPOTENCY_STORE');
