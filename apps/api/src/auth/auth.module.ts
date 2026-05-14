import { Module } from '@nestjs/common';
import { HeaderRoleGuard } from './header-role.guard';

@Module({
  providers: [HeaderRoleGuard],
  exports: [HeaderRoleGuard],
})
export class AuthModule {}
