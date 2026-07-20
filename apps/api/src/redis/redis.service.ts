import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { Env } from '../config/env.schema';
import type { IdempotencyStore, TokenRevocationStore } from './redis.interfaces';

@Injectable()
export class RedisService implements OnModuleDestroy, TokenRevocationStore, IdempotencyStore {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(config: ConfigService<Env, true>) {
    const url = config.get('REDIS_URL', { infer: true }).trim();
    const isTls = url.startsWith('rediss://');

    // Upstash (and many Windows/DNS setups) need TLS + no ready-check quirks.
    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      connectTimeout: 15_000,
      // Prefer IPv4 — avoids some Windows dual-stack hangs to Upstash
      family: 4,
      ...(isTls ? { tls: { rejectUnauthorized: true } } : {}),
      retryStrategy: (times) => {
        if (times > 8) return null;
        return Math.min(times * 200, 2000);
      },
    });

    this.client.on('error', (err) => {
      this.logger.error(`Redis error: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  private wrap<T>(op: Promise<T>): Promise<T> {
    return op.catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Redis unavailable';
      this.logger.error(msg);
      throw new ServiceUnavailableException(
        'Redis is unavailable. Check REDIS_URL in .env (Upstash rediss:// URL) and that the database is active.',
      );
    });
  }

  async ping(): Promise<boolean> {
    const res = await this.wrap(this.client.ping());
    return res === 'PONG';
  }

  async revoke(jti: string, ttlSeconds: number): Promise<void> {
    const ttl = Math.max(1, Math.ceil(ttlSeconds));
    await this.wrap(this.client.set(`jwt:denylist:${jti}`, '1', 'EX', ttl));
  }

  async isRevoked(jti: string): Promise<boolean> {
    const v = await this.wrap(this.client.get(`jwt:denylist:${jti}`));
    return v !== null;
  }

  private idemKey(key: string): string {
    return `idempotency:sale:${key}`;
  }

  async claim(key: string, saleId: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.wrap(
      this.client.set(
        this.idemKey(key),
        saleId,
        'EX',
        Math.max(1, ttlSeconds),
        'NX',
      ),
    );
    return result === 'OK';
  }

  async set(key: string, saleId: string, ttlSeconds: number): Promise<void> {
    await this.wrap(
      this.client.set(this.idemKey(key), saleId, 'EX', Math.max(1, ttlSeconds)),
    );
  }

  async get(key: string): Promise<string | null> {
    return this.wrap(this.client.get(this.idemKey(key)));
  }

  async del(key: string): Promise<void> {
    await this.wrap(this.client.del(this.idemKey(key)));
  }
}
