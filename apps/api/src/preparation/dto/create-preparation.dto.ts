import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class PreparationReadyItemDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  @IsUUID()
  reservationItemId!: string;

  @ApiProperty({ example: 6, minimum: 0 })
  @IsInt()
  @Min(0)
  readyQuantity!: number;

  @ApiPropertyOptional({ example: 1, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  discrepancyQuantity?: number;

  @ApiPropertyOptional({ example: 'Material no encontrado en ubicación.' })
  @IsOptional()
  @IsString()
  discrepancyReason?: string;
}

export class CreatePreparationDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID()
  reservationId!: string;

  @ApiProperty({ type: [PreparationReadyItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PreparationReadyItemDto)
  items!: PreparationReadyItemDto[];

  @ApiPropertyOptional({ example: 'Preparación física validada por depósito.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
