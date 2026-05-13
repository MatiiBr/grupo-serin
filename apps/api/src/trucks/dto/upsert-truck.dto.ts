import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { LoadingMethod } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateTruckCatalogDto {
  @ApiProperty({ example: 'ABC123' })
  @IsString()
  @MaxLength(32)
  plate!: string;

  @ApiPropertyOptional({ example: 'Semi con barandas rebatibles' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: LoadingMethod, default: LoadingMethod.REAR })
  @IsOptional()
  @IsEnum(LoadingMethod)
  loadingMethod?: LoadingMethod;

  @ApiPropertyOptional({ example: 28000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPayloadKg?: number;

  @ApiPropertyOptional({ example: 13600 })
  @IsOptional()
  @IsInt()
  @Min(0)
  lengthMm?: number;

  @ApiPropertyOptional({ example: 2450 })
  @IsOptional()
  @IsInt()
  @Min(0)
  widthMm?: number;

  @ApiPropertyOptional({ example: 2700 })
  @IsOptional()
  @IsInt()
  @Min(0)
  heightMm?: number;
}

export class UpdateTruckCatalogDto extends PartialType(CreateTruckCatalogDto) {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateTrailerCatalogDto {
  @ApiProperty({ example: 'SEMI-001' })
  @IsString()
  @MaxLength(64)
  code!: string;

  @ApiPropertyOptional({ example: 'Semirremolque playo 13.6m' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 28000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPayloadKg?: number;

  @ApiPropertyOptional({ example: 13600 })
  @IsOptional()
  @IsInt()
  @Min(0)
  lengthMm?: number;

  @ApiPropertyOptional({ example: 2450 })
  @IsOptional()
  @IsInt()
  @Min(0)
  widthMm?: number;

  @ApiPropertyOptional({ example: 2700 })
  @IsOptional()
  @IsInt()
  @Min(0)
  heightMm?: number;
}

export class UpdateTrailerCatalogDto extends PartialType(CreateTrailerCatalogDto) {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpsertOperationVehicleAssignmentDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  truckCatalogId!: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsOptional()
  @IsUUID()
  trailerCatalogId?: string;

  @ApiPropertyOptional({ example: 'Usar trailer asignado para ruta larga.' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpsertTruckDto extends CreateTruckCatalogDto {}
