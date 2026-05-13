import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ example: 'CLI-001' })
  @IsString()
  @MaxLength(128)
  code!: string;

  @ApiProperty({ example: 'Aceros del Sur' })
  @IsString()
  @MaxLength(256)
  name!: string;

  @ApiPropertyOptional({ example: '30-12345678-9' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  taxId?: string;

  @ApiPropertyOptional({ example: 'Cliente con descarga prioritaria.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
