import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SellerPriority } from '@prisma/client';
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';

export class CreateOrderItemDto {
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  productCatalogId?: string;

  @ApiProperty({ example: 'CHAPA-001' })
  @IsString()
  @MaxLength(128)
  productCode!: string;

  @ApiPropertyOptional({ example: 'Paquete de chapas laminadas' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ example: 1250.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @ApiPropertyOptional({ example: 6000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  lengthMm?: number;

  @ApiPropertyOptional({ example: 1500 })
  @IsOptional()
  @IsInt()
  @Min(0)
  widthMm?: number;

  @ApiPropertyOptional({ example: 800 })
  @IsOptional()
  @IsInt()
  @Min(0)
  heightMm?: number;

  @ApiPropertyOptional({ example: 'Cargar con separadores.' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateOrderDto {
  @ApiPropertyOptional({ example: 'PED-20260513-001' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  code?: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  customerId!: string;

  @ApiPropertyOptional({ enum: SellerPriority, example: SellerPriority.NORMAL, default: SellerPriority.NORMAL })
  @IsOptional()
  @IsEnum(SellerPriority)
  sellerPriority?: SellerPriority;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsOptional()
  @IsUUID()
  destinationCatalogId?: string;

  @ApiPropertyOptional({ example: 'Planta Rosario' })
  @IsOptional()
  @IsString()
  destinationName?: string;

  @ApiPropertyOptional({ example: '2026-05-20T12:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  requestedDeliveryAt?: string;

  @ApiPropertyOptional({ example: 'SERIN-12345' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  externalRef?: string;

  @ApiPropertyOptional({ example: 'Ingreso manual inicial.' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}
