import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductFamily } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class UpdateProductDto {
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000', nullable: true })
  @IsOptional()
  @IsUUID()
  destinationId?: string | null;

  @ApiPropertyOptional({ example: 'CHAPA-001' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  code?: string;

  @ApiPropertyOptional({ enum: ProductFamily })
  @IsOptional()
  @IsEnum(ProductFamily)
  family?: ProductFamily;

  @ApiPropertyOptional({ example: 'Paquete de chapas laminadas' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 1 })
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

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  stackable?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  rotationAllowed?: boolean;
}
