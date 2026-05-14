import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AUTH_ACTOR_HEADER, AUTH_ROLE_HEADER, AUTH_ROLES_KEY, AuthRole } from './roles';

type HeaderValue = string | string[] | undefined;

@Injectable()
export class HeaderRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.getRequiredRoles(context);
    if (requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ headers?: Record<string, HeaderValue> }>();
    const actor = this.firstHeaderValue(request.headers?.[AUTH_ACTOR_HEADER]);
    const roles = this.parseRoles(request.headers?.[AUTH_ROLE_HEADER]);

    if (!actor || roles.length === 0) {
      throw new UnauthorizedException('x-actor and x-role headers are required for this operation.');
    }

    if (roles.includes(AuthRole.ADMIN) || requiredRoles.some((role) => roles.includes(role))) {
      return true;
    }

    throw new ForbiddenException('Actor does not have permission to perform this operation.');
  }

  private getRequiredRoles(context: ExecutionContext): AuthRole[] {
    return (
      Reflect.getMetadata(AUTH_ROLES_KEY, context.getHandler()) ?? Reflect.getMetadata(AUTH_ROLES_KEY, context.getClass()) ?? []
    );
  }

  private firstHeaderValue(value: HeaderValue) {
    return Array.isArray(value) ? value[0]?.trim() : value?.trim();
  }

  private parseRoles(value: HeaderValue): AuthRole[] {
    const headerValue = this.firstHeaderValue(value);
    if (!headerValue) {
      return [];
    }

    return headerValue
      .split(',')
      .map((role) => role.trim())
      .filter((role): role is AuthRole => Object.values(AuthRole).includes(role as AuthRole));
  }
}
