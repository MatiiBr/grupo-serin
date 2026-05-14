import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { DispatchController } from '../dispatch/dispatch.controller';
import { LoadingPlansController } from '../loading-plans/loading-plans.controller';
import { ReservationsController } from '../reservations/reservations.controller';
import { TransportController } from '../transport/transport.controller';
import { HeaderRoleGuard } from './header-role.guard';
import { AUTH_ROLES_KEY, AuthRole } from './roles';

function createContext(handler: () => unknown, headers: Record<string, string | undefined> = {}): ExecutionContext {
  return ({
    getClass: () => class TestController {},
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown) as ExecutionContext;
}

function protectedHandler() {
  return undefined;
}

Reflect.defineMetadata(AUTH_ROLES_KEY, [AuthRole.DISPATCH_OPERATOR], protectedHandler);

describe('HeaderRoleGuard', () => {
  it('rejects sensitive operations without actor and role headers', () => {
    const guard = new HeaderRoleGuard();

    expect(() => guard.canActivate(createContext(protectedHandler))).toThrow(UnauthorizedException);
  });

  it('rejects actors with insufficient roles', () => {
    const guard = new HeaderRoleGuard();

    expect(() => guard.canActivate(createContext(protectedHandler, { 'x-actor': 'ops@example.com', 'x-role': AuthRole.WAREHOUSE_OPERATOR }))).toThrow(ForbiddenException);
  });

  it('allows actors with a required role', () => {
    const guard = new HeaderRoleGuard();

    expect(guard.canActivate(createContext(protectedHandler, { 'x-actor': 'dispatcher@example.com', 'x-role': AuthRole.DISPATCH_OPERATOR }))).toBe(true);
  });

  it('allows admin actors across protected operations', () => {
    const guard = new HeaderRoleGuard();

    expect(guard.canActivate(createContext(protectedHandler, { 'x-actor': 'admin@example.com', 'x-role': AuthRole.ADMIN }))).toBe(true);
  });

  it('marks sensitive logistics transition handlers with role metadata', () => {
    expect(Reflect.getMetadata(AUTH_ROLES_KEY, ReservationsController.prototype.release)).toContain(AuthRole.WAREHOUSE_OPERATOR);
    expect(Reflect.getMetadata(AUTH_ROLES_KEY, DispatchController.prototype.createLoadOperation)).toContain(AuthRole.DISPATCH_OPERATOR);
    expect(Reflect.getMetadata(AUTH_ROLES_KEY, LoadingPlansController.prototype.approve)).toContain(AuthRole.LOADING_SUPERVISOR);
    expect(Reflect.getMetadata(AUTH_ROLES_KEY, TransportController.prototype.authorizeExit)).toContain(AuthRole.GATE_OPERATOR);
  });
});
