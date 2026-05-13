import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { LoadingPlansController } from './loading-plans.controller';
import { LoadingPlansService } from './loading-plans.service';

@Module({
  imports: [AuditModule],
  controllers: [LoadingPlansController],
  providers: [LoadingPlansService],
})
export class LoadingPlansModule {}
