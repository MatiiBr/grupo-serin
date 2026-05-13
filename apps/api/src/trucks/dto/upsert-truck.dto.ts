import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LoadingMethod } from '@prisma/client';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpsertTruckDto {
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
