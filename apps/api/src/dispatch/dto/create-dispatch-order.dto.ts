import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateDispatchOrderDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  orderId!: string;

  @ApiPropertyOptional({ example: 'DSP-20260513-001' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  code?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsOptional()
  @IsUUID()
  deliveryPlanId?: string;

  @ApiPropertyOptional({ example: 'Preparar como snapshot para carga.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
