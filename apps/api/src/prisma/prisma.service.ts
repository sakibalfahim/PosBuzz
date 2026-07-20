import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import type { Env } from '../config/env.schema';

function withConnectionLimit(url: string, limit = 5): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has('connection_limit')) {
      u.searchParams.set('connection_limit', String(limit));
    }
    return u.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    if (url.includes('connection_limit=')) return url;
    return `${url}${sep}connection_limit=${limit}`;
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService<Env, true>) {
    // Long-lived Nest process: use DIRECT_URL (non-pooler) so interactive
    // $transaction is safe. Skip Neon transaction-mode PgBouncer.
    const directUrl = withConnectionLimit(config.get('DIRECT_URL', { infer: true }));
    super({
      datasources: {
        db: { url: directUrl },
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
