import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuditModule } from './audit/audit.module';
import { CustomsModule } from './customs/customs.module';
import { DestinationsModule } from './destinations/destinations.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { LoadingPlansModule } from './loading-plans/loading-plans.module';
import { OperationsModule } from './operations/operations.module';
import { OrdersModule } from './orders/orders.module';
import { PreparationModule } from './preparation/preparation.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { ReservationsModule } from './reservations/reservations.module';
import { TrucksModule } from './trucks/trucks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuditModule,
    CustomsModule,
    PrismaModule,
    OperationsModule,
    TrucksModule,
    DestinationsModule,
    DispatchModule,
    ProductsModule,
    PreparationModule,
    ReservationsModule,
    OrdersModule,
    LoadingPlansModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
