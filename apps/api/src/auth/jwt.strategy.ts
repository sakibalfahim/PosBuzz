import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import {
  TOKEN_REVOCATION_STORE,
  type TokenRevocationStore,
} from '../redis/redis.interfaces';
import type { AuthUser, JwtPayload } from './auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<Env, true>,
    @Inject(TOKEN_REVOCATION_STORE) private readonly revocation: TokenRevocationStore,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (!payload?.sub || !payload?.jti || !payload?.email) {
      throw new UnauthorizedException('Invalid token payload');
    }
    if (await this.revocation.isRevoked(payload.jti)) {
      throw new UnauthorizedException('Token revoked');
    }
    return {
      userId: payload.sub,
      email: payload.email,
      jti: payload.jti,
    };
  }
}
