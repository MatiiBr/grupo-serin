import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateDestinationDto {
  @ApiPropertyOptional({ example: 'CLI-001' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @ApiProperty({ example: 'Cliente Norte' })
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  unloadingOrder!: number;

  @ApiPropertyOptional({ example: 'Ruta 8 km 45' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Descargar con autoelevador.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
