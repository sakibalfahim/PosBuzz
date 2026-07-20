import { Global, Module } from '@nestjs/common';
import { IDEMPOTENCY_STORE, TOKEN_REVOCATION_STORE } from './redis.interfaces';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    RedisService,
    { provide: TOKEN_REVOCATION_STORE, useExisting: RedisService },
    { provide: IDEMPOTENCY_STORE, useExisting: RedisService },
  ],
  exports: [RedisService, TOKEN_REVOCATION_STORE, IDEMPOTENCY_STORE],
})
export class RedisModule {}
