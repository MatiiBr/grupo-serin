import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { LoadingPlansController } from './loading-plans.controller';
import { LoadingPlansService } from './loading-plans.service';

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [LoadingPlansController],
  providers: [LoadingPlansService],
})
export class LoadingPlansModule {}
