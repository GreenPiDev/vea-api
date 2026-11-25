import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy, type JwtPayload } from './jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';

describe('JwtStrategy.validate', () => {
  const tokenClaims: JwtPayload = {
    sub: 'user-1',
    email: 'admin@example.com',
    role: 'GALLERY_ADMIN',
    organizationId: 'org-1',
  };

  let findUnique: jest.Mock<Promise<unknown>, [unknown]>;
  let strategy: JwtStrategy;

  beforeEach(() => {
    findUnique = jest.fn<Promise<unknown>, [unknown]>();
    const config = { get: () => 'test-secret' } as unknown as ConfigService;
    strategy = new JwtStrategy(config, {
      user: { findUnique },
    } as unknown as PrismaService);
  });

  it("uses the DB's current role/org, not the token's claims (removed admin loses access immediately)", async () => {
    findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'admin@example.com',
      role: 'VISITOR',
      organizationId: null,
    });

    await expect(strategy.validate(tokenClaims)).resolves.toEqual({
      sub: 'user-1',
      email: 'admin@example.com',
      role: 'VISITOR',
      organizationId: null,
    });
  });

  it('picks up a move to another organization without a re-login', async () => {
    findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'admin@example.com',
      role: 'GALLERY_ADMIN',
      organizationId: 'org-2',
    });

    const user = await strategy.validate(tokenClaims);
    expect(user.organizationId).toBe('org-2');
  });

  it('rejects a still-valid token whose user no longer exists', async () => {
    findUnique.mockResolvedValueOnce(null);

    await expect(strategy.validate(tokenClaims)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('looks the user up by the token subject only', async () => {
    findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'admin@example.com',
      role: 'GALLERY_ADMIN',
      organizationId: 'org-1',
    });

    await strategy.validate(tokenClaims);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } }),
    );
  });
});
