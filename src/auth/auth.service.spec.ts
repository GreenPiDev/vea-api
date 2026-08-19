import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';

interface VerificationCodeRecord {
  id: string;
  attempts: number;
  expiresAt: Date;
  codeHash: string;
}

describe('AuthService', () => {
  const user = { id: 'user-1', email: 'artist@example.com' };

  type CreateArgs = { data: { userId: string; codeHash: string } };

  let prisma: {
    verificationCode: {
      updateMany: jest.Mock<Promise<{ count: number }>, [unknown]>;
      create: jest.Mock<Promise<unknown>, [CreateArgs]>;
      findFirst: jest.Mock<Promise<VerificationCodeRecord | null>, [unknown]>;
      update: jest.Mock<Promise<unknown>, [unknown]>;
    };
  };
  let users: {
    findOrCreateByEmail: jest.Mock<Promise<typeof user>, [string]>;
    findByEmail: jest.Mock<Promise<typeof user | null>, [string]>;
  };
  let mail: {
    sendVerificationCode: jest.Mock<Promise<void>, [string, string]>;
  };
  let jwt: { signAsync: jest.Mock<Promise<string>, [unknown]> };
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      verificationCode: {
        updateMany: jest
          .fn<Promise<{ count: number }>, [unknown]>()
          .mockResolvedValue({ count: 0 }),
        create: jest.fn<Promise<unknown>, [CreateArgs]>().mockResolvedValue({}),
        findFirst: jest.fn<Promise<VerificationCodeRecord | null>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
      },
    };
    users = {
      findOrCreateByEmail: jest
        .fn<Promise<typeof user>, [string]>()
        .mockResolvedValue(user),
      findByEmail: jest
        .fn<Promise<typeof user | null>, [string]>()
        .mockResolvedValue(user),
    };
    mail = {
      sendVerificationCode: jest
        .fn<Promise<void>, [string, string]>()
        .mockResolvedValue(undefined),
    };
    jwt = {
      signAsync: jest
        .fn<Promise<string>, [unknown]>()
        .mockResolvedValue('signed.jwt.token'),
    };

    service = new AuthService(
      prisma as unknown as PrismaService,
      users as unknown as UsersService,
      mail as unknown as MailService,
      jwt as unknown as JwtService,
    );
  });

  describe('requestCode', () => {
    it('invalidates prior unconsumed codes, stores a hashed new one, and emails it', async () => {
      await service.requestCode(user.email);

      expect(prisma.verificationCode.updateMany).toHaveBeenCalledWith({
        where: { userId: user.id, channel: 'EMAIL', consumedAt: null },
        data: { consumedAt: expect.any(Date) as Date },
      });
      expect(prisma.verificationCode.create).toHaveBeenCalledTimes(1);

      const [createArgs] = prisma.verificationCode.create.mock.calls[0];
      expect(createArgs.data.userId).toBe(user.id);
      expect(createArgs.data.codeHash).not.toBe(undefined);

      expect(mail.sendVerificationCode).toHaveBeenCalledTimes(1);
      const [emailedTo, plainCode] = mail.sendVerificationCode.mock.calls[0];
      expect(emailedTo).toBe(user.email);
      expect(plainCode).toMatch(/^\d{6}$/);
    });
  });

  describe('verifyCode', () => {
    it('rejects when no user exists for the email', async () => {
      users.findByEmail.mockResolvedValueOnce(null);

      await expect(service.verifyCode(user.email, '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects when there is no pending code', async () => {
      prisma.verificationCode.findFirst.mockResolvedValueOnce(null);

      await expect(service.verifyCode(user.email, '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an expired code', async () => {
      prisma.verificationCode.findFirst.mockResolvedValueOnce({
        id: 'code-1',
        attempts: 0,
        expiresAt: new Date(Date.now() - 1000),
        codeHash: 'irrelevant',
      });

      await expect(service.verifyCode(user.email, '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects and increments attempts on a wrong code', async () => {
      // Issue a real code first so we have a real bcrypt hash to compare against.
      await service.requestCode(user.email);
      const [, plainCode] = mail.sendVerificationCode.mock.calls[0];
      const [createArgs] = prisma.verificationCode.create.mock.calls[0];

      prisma.verificationCode.findFirst.mockResolvedValueOnce({
        id: 'code-1',
        attempts: 0,
        expiresAt: new Date(Date.now() + 60_000),
        codeHash: createArgs.data.codeHash,
      });

      const wrongCode = plainCode === '000000' ? '111111' : '000000';
      await expect(service.verifyCode(user.email, wrongCode)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.verificationCode.update).toHaveBeenCalledWith({
        where: { id: 'code-1' },
        data: { attempts: { increment: 1 } },
      });
    });

    it('invalidates the code once MAX_ATTEMPTS is reached, without checking the hash', async () => {
      prisma.verificationCode.findFirst.mockResolvedValueOnce({
        id: 'code-1',
        attempts: 5,
        expiresAt: new Date(Date.now() + 60_000),
        codeHash: 'irrelevant',
      });

      await expect(service.verifyCode(user.email, '123456')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.verificationCode.update).toHaveBeenCalledWith({
        where: { id: 'code-1' },
        data: { consumedAt: expect.any(Date) as Date },
      });
    });

    it('issues an access token and consumes the code on a correct match', async () => {
      await service.requestCode(user.email);
      const [, plainCode] = mail.sendVerificationCode.mock.calls[0];
      const [createArgs] = prisma.verificationCode.create.mock.calls[0];

      prisma.verificationCode.findFirst.mockResolvedValueOnce({
        id: 'code-1',
        attempts: 0,
        expiresAt: new Date(Date.now() + 60_000),
        codeHash: createArgs.data.codeHash,
      });

      const result = await service.verifyCode(user.email, plainCode);

      expect(result).toEqual({ accessToken: 'signed.jwt.token' });
      expect(prisma.verificationCode.update).toHaveBeenCalledWith({
        where: { id: 'code-1' },
        data: { consumedAt: expect.any(Date) as Date },
      });
      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: user.id,
        email: user.email,
      });
    });
  });
});
