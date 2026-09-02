import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  function makeContext(role: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user: { sub: 'u1', email: 'a@b.com', role } }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  it('allows the request when the route has no @Roles() metadata', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext('VISITOR'))).toBe(true);
  });

  it('rejects a user whose role is not in the required list', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['GALLERY_ADMIN']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(makeContext('SELLER'))).toThrow(
      ForbiddenException,
    );
  });

  it('allows a user whose role is in the required list', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['GALLERY_ADMIN']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext('GALLERY_ADMIN'))).toBe(true);
  });
});
