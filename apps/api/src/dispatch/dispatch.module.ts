import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DispatchController } from './dispatch.controller';
import { DispatchService } from './dispatch.service';

@Module({
  imports: [AuditModule],
  controllers: [DispatchController],
  providers: [DispatchService],
})
export class DispatchModule {}
