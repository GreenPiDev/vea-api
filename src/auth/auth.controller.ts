import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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

  @Post('request-code')
  @HttpCode(202)
  @Throttle({ default: { limit: 3, ttl: 600_000 } })
  async requestCode(@Body() dto: RequestCodeDto): Promise<{ status: string }> {
    await this.auth.requestCode(dto.email);
    return { status: 'sent' };
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
