import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateCustomsReleaseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID()
  dispatchOrderId!: string;

  @ApiPropertyOptional({ example: 'ADU-2026-0001' })
  @IsOptional()
  @IsString()
  externalRef?: string;

  @ApiPropertyOptional({ example: 'Carga requiere liberación de aduana antes de despacho.' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ClearCustomsReleaseDto {
  @ApiPropertyOptional({ example: 'ADU-2026-0001' })
  @IsOptional()
  @IsString()
  externalRef?: string;

  @ApiPropertyOptional({ example: 'Liberado por aduana.' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class BlockCustomsReleaseDto {
  @ApiProperty({ example: 'Documentación de exportación incompleta.' })
  @IsString()
  @MinLength(1)
  blockedReason!: string;

  @ApiPropertyOptional({ example: 'Pendiente regularización documental.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
