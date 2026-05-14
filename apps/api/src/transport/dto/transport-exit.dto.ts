import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateTransportExitDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID()
  dispatchOrderId!: string;

  @ApiPropertyOptional({ example: 'DSP-SALIDA-2026-0001' })
  @IsOptional()
  @IsString()
  externalRef?: string;

  @ApiPropertyOptional({ example: 'Control de salida creado para despacho aprobado.' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class MarkTransportDocsReadyDto {
  @ApiPropertyOptional({ example: 'DOC-2026-0001' })
  @IsOptional()
  @IsString()
  externalRef?: string;

  @ApiPropertyOptional({ example: 'Remito y documentación de despacho disponibles.' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordTransportScaleDto {
  @ApiProperty({ example: 28500 })
  @IsNumber()
  @IsPositive()
  scaleWeightKg!: number;

  @ApiPropertyOptional({ example: 'BASC-2026-0001' })
  @IsOptional()
  @IsString()
  externalRef?: string;

  @ApiPropertyOptional({ example: 'Peso registrado por balanza.' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class BlockTransportExitDto {
  @ApiProperty({ example: 'Documentación de transporte incompleta.' })
  @IsString()
  @MinLength(1)
  blockedReason!: string;

  @ApiPropertyOptional({ example: 'Pendiente corrección antes de autorizar salida.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
