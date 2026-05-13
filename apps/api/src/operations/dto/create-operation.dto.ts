import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateOperationDto {
  @ApiPropertyOptional({ example: 'OP-2026-0001' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @ApiPropertyOptional({ example: 'Carga para obra norte' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'Priorizar descarga por puerta lateral.' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: '2026-05-13T10:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledAt?: Date;
}
