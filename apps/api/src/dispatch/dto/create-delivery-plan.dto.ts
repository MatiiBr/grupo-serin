import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDeliveryPlanDto {
  @ApiPropertyOptional({ example: 'DP-20260513-001' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  code?: string;

  @ApiPropertyOptional({ example: '2026-05-20T12:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  plannedDate?: string;

  @ApiPropertyOptional({ example: 'Consolidación inicial para Rosario.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
