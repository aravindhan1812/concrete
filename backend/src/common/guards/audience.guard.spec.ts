import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUDIENCE_KEY } from '../decorators/audience.decorator';
import { AuthUser, UserKind } from '../types';
import { AudienceGuard } from './audience.guard';

function ctx(user: Partial<AuthUser> | undefined, audience?: UserKind[]): ExecutionContext {
  const reflector = { getAllAndOverride: jest.fn((key: string) => (key === AUDIENCE_KEY ? audience : undefined)) };
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return Object.assign(context, { reflector });
}

function guardFor(context: ExecutionContext) {
  return new AudienceGuard((context as unknown as { reflector: Reflector }).reflector);
}

describe('AudienceGuard', () => {
  it('lets public routes (no user) through', () => {
    const c = ctx(undefined);
    expect(guardFor(c).canActivate(c)).toBe(true);
  });

  it('serves staff on routes with no audience declared', () => {
    const c = ctx({ kind: 'staff' });
    expect(guardFor(c).canActivate(c)).toBe(true);
  });

  it('blocks customer and vendor logins from undeclared (internal) routes', () => {
    for (const kind of ['customer', 'vendor'] as UserKind[]) {
      const c = ctx({ kind });
      expect(() => guardFor(c).canActivate(c)).toThrow(ForbiddenException);
    }
  });

  it('serves the declared audience and nobody else', () => {
    const ok = ctx({ kind: 'customer' }, ['customer']);
    expect(guardFor(ok).canActivate(ok)).toBe(true);
    const vendor = ctx({ kind: 'vendor' }, ['customer']);
    expect(() => guardFor(vendor).canActivate(vendor)).toThrow(ForbiddenException);
    const staff = ctx({ kind: 'staff' }, ['customer']);
    expect(() => guardFor(staff).canActivate(staff)).toThrow(ForbiddenException);
  });

  it('AnyAudience-style routes serve everyone', () => {
    for (const kind of ['staff', 'customer', 'vendor'] as UserKind[]) {
      const c = ctx({ kind }, ['staff', 'customer', 'vendor']);
      expect(guardFor(c).canActivate(c)).toBe(true);
    }
  });
});
