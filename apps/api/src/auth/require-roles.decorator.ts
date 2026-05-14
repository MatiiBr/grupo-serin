import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { HeaderRoleGuard } from './header-role.guard';
import { AUTH_ROLES_KEY, AuthRole } from './roles';

export function RequireRoles(...roles: AuthRole[]) {
  return applyDecorators(SetMetadata(AUTH_ROLES_KEY, roles), UseGuards(HeaderRoleGuard));
}
