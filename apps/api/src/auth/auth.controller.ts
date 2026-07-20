import { Body, Controller, Get, Post, Req, UseGuards, HttpCode } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthUser } from './auth.types';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  logout(@CurrentUser() user: AuthUser, @Req() req: Request & { user?: AuthUser }) {
    const auth = req.headers.authorization;
    let exp: number | undefined;
    if (auth?.startsWith('Bearer ')) {
      try {
        const [, payloadB64] = auth.slice(7).split('.');
        const json = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
          exp?: number;
        };
        exp = json.exp;
      } catch {
        exp = undefined;
      }
    }
    return this.auth.logout(user, exp);
  }
}
