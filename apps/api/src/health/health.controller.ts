import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Liveness for Render — process is up. Do not depend on Redis here. */
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /** Deep readiness: DB + Redis. */
  @Get('health/ready')
  async ready() {
    let db = false;
    let redis = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = true;
    } catch {
      db = false;
    }
    try {
      redis = await this.redis.ping();
    } catch {
      redis = false;
    }
    const ok = db && redis;
    return {
      status: ok ? 'ready' : 'not_ready',
      checks: { database: db, redis },
      timestamp: new Date().toISOString(),
    };
  }
}
