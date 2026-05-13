import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateDestinationDto {
  @ApiPropertyOptional({ example: 'CLI-001' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @ApiPropertyOptional({ example: 'Cliente Norte' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  unloadingOrder?: number;

  @ApiPropertyOptional({ example: 'Ruta 8 km 45' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Descargar con autoelevador.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
