import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PreparationController } from './preparation.controller';
import { PreparationService } from './preparation.service';

@Module({
  imports: [AuditModule, PrismaModule],
  controllers: [PreparationController],
  providers: [PreparationService],
  exports: [PreparationService],
})
export class PreparationModule {}
