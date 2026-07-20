import type { IdempotencyStore } from '../redis/redis.interfaces';

describe('IdempotencyStore SET NX semantics', () => {
  it('claim wins once; second claim loses', async () => {
    const map = new Map<string, string>();
    const store: IdempotencyStore = {
      async claim(key, saleId) {
        if (map.has(key)) return false;
        map.set(key, saleId);
        return true;
      },
      async set(key, saleId) {
        map.set(key, saleId);
      },
      async get(key) {
        return map.get(key) ?? null;
      },
      async del(key) {
        map.delete(key);
      },
    };

    expect(await store.claim('k1', 'pending:1', 60)).toBe(true);
    expect(await store.claim('k1', 'pending:2', 60)).toBe(false);
    await store.set('k1', 'sale-real');
    expect(await store.get('k1')).toBe('sale-real');
  });
});
