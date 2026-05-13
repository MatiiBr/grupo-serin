import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductFamily } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateProductDto {
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  destinationId?: string;

  @ApiProperty({ example: 'CHAPA-001' })
  @IsString()
  @MaxLength(128)
  code!: string;

  @ApiProperty({ enum: ProductFamily, example: ProductFamily.SHEET })
  @IsEnum(ProductFamily)
  family!: ProductFamily;

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

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  stackable?: boolean;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  rotationAllowed?: boolean;
}
