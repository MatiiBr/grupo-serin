import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TransportController } from './transport.controller';
import { TransportService } from './transport.service';

@Module({
  imports: [AuditModule, AuthModule, PrismaModule],
  controllers: [TransportController],
  providers: [TransportService],
})
export class TransportModule {}
