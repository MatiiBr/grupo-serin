import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CustomsController } from './customs.controller';
import { CustomsService } from './customs.service';

@Module({
  imports: [AuditModule, AuthModule, PrismaModule],
  controllers: [CustomsController],
  providers: [CustomsService],
})
export class CustomsModule {}
