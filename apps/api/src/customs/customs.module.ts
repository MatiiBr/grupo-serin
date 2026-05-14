import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CustomsController } from './customs.controller';
import { CustomsService } from './customs.service';

@Module({
  imports: [AuditModule, PrismaModule],
  controllers: [CustomsController],
  providers: [CustomsService],
})
export class CustomsModule {}
