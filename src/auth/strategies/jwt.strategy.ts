import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  organizationId: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
    });
  }

  // The token only proves *who* the caller is. Role and organization are
  // re-read from the DB on every authenticated request instead of trusted
  // from the token's claims: a token lives 7 days, and trusting its claims
  // meant an admin removed from an organization (or a demoted/deleted user)
  // kept their old access until it expired. Cost: one primary-key lookup per
  // authenticated request — negligible next to the work the request does.
  // Everything downstream (RolesGuard, @CurrentUser(), org scoping) reads
  // request.user, so this is the single place the fix needs to live.
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, organizationId: true },
    });
    if (!user) {
      // Deleted user (e.g. after a data reset) holding a still-valid token.
      throw new UnauthorizedException();
    }
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };
  }
}
