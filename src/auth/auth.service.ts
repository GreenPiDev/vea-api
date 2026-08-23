import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const BCRYPT_ROUNDS = 10;

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
  ) {}

  async requestCode(email: string): Promise<void> {
    const user = await this.users.findOrCreateByEmail(email);

    // Invalidate any still-usable prior codes so only the newest one works.
    await this.prisma.verificationCode.updateMany({
      where: { userId: user.id, channel: 'EMAIL', consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const code = generateCode();
    const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);

    await this.prisma.verificationCode.create({
      data: {
        userId: user.id,
        channel: 'EMAIL',
        codeHash,
        expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
      },
    });

    await this.mail.sendVerificationCode(email, code);
  }

  async verifyCode(
    email: string,
    code: string,
  ): Promise<{ accessToken: string }> {
    const user = await this.users.findByEmail(email);
    const invalid = () => new UnauthorizedException('Invalid or expired code');
    if (!user) throw invalid();

    const record = await this.prisma.verificationCode.findFirst({
      where: { userId: user.id, channel: 'EMAIL', consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw invalid();
    if (record.expiresAt < new Date()) throw invalid();
    if (record.attempts >= MAX_ATTEMPTS) {
      await this.prisma.verificationCode.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      });
      throw invalid();
    }

    const matches = await bcrypt.compare(code, record.codeHash);
    if (!matches) {
      await this.prisma.verificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw invalid();
    }

    await this.prisma.verificationCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    });
    return { accessToken };
  }
}
