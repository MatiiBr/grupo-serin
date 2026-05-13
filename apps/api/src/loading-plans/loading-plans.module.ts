import { Module } from '@nestjs/common';
import { LoadingPlansController } from './loading-plans.controller';
import { LoadingPlansService } from './loading-plans.service';

@Module({
  controllers: [LoadingPlansController],
  providers: [LoadingPlansService],
})
export class LoadingPlansModule {}
