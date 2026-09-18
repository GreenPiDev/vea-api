import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RequestCodeDto } from './dto/request-code.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import type { JwtPayload } from './strategies/jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  // Rate limiting disabled for now (pre-launch) — the previous 3-per-10min
  // limit meant testers had to restart the backend to request a new code.
  // Re-enable (@Throttle({ default: { limit: 3, ttl: 600_000 } })) before
  // real launch — abuse/spam protection is still on the security backlog.
  @Post('request-code')
  @HttpCode(202)
  @SkipThrottle()
  async requestCode(
    @Body() dto: RequestCodeDto,
  ): Promise<{ status: string; devCode: string }> {
    // devCode: pre-launch convenience since MailService is still a stub —
    // remove once a real provider sends the email instead.
    const devCode = await this.auth.requestCode(dto.email);
    return { status: 'sent', devCode };
  }

  @Post('verify-code')
  @HttpCode(200)
  async verifyCode(
    @Body() dto: VerifyCodeDto,
  ): Promise<{ accessToken: string }> {
    return this.auth.verifyCode(dto.email, dto.code);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: JwtPayload) {
    return this.users.findById(user.sub);
  }
}
