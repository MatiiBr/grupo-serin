import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { DispatchController } from './dispatch.controller';
import { DispatchService } from './dispatch.service';

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [DispatchController],
  providers: [DispatchService],
})
export class DispatchModule {}
