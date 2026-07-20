import { AuthService } from './auth.service';
import type { TokenRevocationStore } from '../redis/redis.interfaces';

describe('AuthService logout denylist', () => {
  it('revokes jti with remaining TTL', async () => {
    const revoked: Array<{ jti: string; ttl: number }> = [];
    const revocation: TokenRevocationStore = {
      revoke: async (jti, ttlSeconds) => {
        revoked.push({ jti, ttl: ttlSeconds });
      },
      isRevoked: async () => false,
    };

    const service = new AuthService(
      {} as never,
      {} as never,
      { get: () => true } as never,
      revocation,
    );

    const now = Math.floor(Date.now() / 1000);
    await service.logout({ userId: 'u1', email: 'a@b.c', jti: 'jti-1' }, now + 120);

    expect(revoked).toHaveLength(1);
    expect(revoked[0].jti).toBe('jti-1');
    expect(revoked[0].ttl).toBeGreaterThan(100);
    expect(revoked[0].ttl).toBeLessThanOrEqual(120);
  });
});
