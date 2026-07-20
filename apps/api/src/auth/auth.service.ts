import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeEmail } from '../common/utils/money';
import type { Env } from '../config/env.schema';
import {
  TOKEN_REVOCATION_STORE,
  type TokenRevocationStore,
} from '../redis/redis.interfaces';
import type { AuthUser, JwtPayload } from './auth.types';
import type { LoginDto, RegisterDto } from './dto/auth.dto';

const JWT_EXPIRES_SECONDS = 60 * 60; // 1h

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    @Inject(TOKEN_REVOCATION_STORE) private readonly revocation: TokenRevocationStore,
  ) {}

  async register(dto: RegisterDto) {
    if (!this.config.get('AUTH_ALLOW_REGISTER', { infer: true })) {
      throw new ForbiddenException('Registration is disabled');
    }
    const email = normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: { email, passwordHash },
    });
    return this.issueTokens(user.id, user.email);
  }

  async login(dto: LoginDto) {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueTokens(user.id, user.email);
  }

  async me(user: AuthUser) {
    const row = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { id: true, email: true, createdAt: true },
    });
    if (!row) {
      throw new UnauthorizedException('User not found');
    }
    return {
      id: row.id,
      email: row.email,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async logout(user: AuthUser, exp?: number): Promise<{ ok: true }> {
    const nowSec = Math.floor(Date.now() / 1000);
    const ttl = exp && exp > nowSec ? exp - nowSec : JWT_EXPIRES_SECONDS;
    await this.revocation.revoke(user.jti, ttl);
    return { ok: true };
  }

  private async issueTokens(userId: string, email: string) {
    const jti = randomUUID();
    const payload: JwtPayload = { sub: userId, email, jti };
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: JWT_EXPIRES_SECONDS,
    });
    return {
      accessToken,
      tokenType: 'Bearer' as const,
      expiresIn: JWT_EXPIRES_SECONDS,
      user: { id: userId, email },
    };
  }
}
