import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { DestinationsModule } from './destinations/destinations.module';
import { LoadingPlansModule } from './loading-plans/loading-plans.module';
import { OperationsModule } from './operations/operations.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { TrucksModule } from './trucks/trucks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    OperationsModule,
    TrucksModule,
    DestinationsModule,
    ProductsModule,
    LoadingPlansModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
