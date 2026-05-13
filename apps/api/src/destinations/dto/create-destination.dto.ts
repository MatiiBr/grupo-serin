import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateDestinationCatalogDto {
  @ApiPropertyOptional({ example: 'CLI-001' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @ApiProperty({ example: 'Cliente Norte' })
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ example: 'Ruta 8 km 45' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Descargar con autoelevador.' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateOperationDestinationAssignmentDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  destinationCatalogId!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  unloadingOrder!: number;

  @ApiPropertyOptional({ example: 'Descargar con autoelevador.' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateDestinationDto extends CreateDestinationCatalogDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  unloadingOrder!: number;
}
