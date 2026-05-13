import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdatePlacedItemDto {
  @ApiPropertyOptional({ example: 1200 })
  @IsOptional()
  @IsInt()
  @Min(0)
  xMm?: number;

  @ApiPropertyOptional({ example: 300 })
  @IsOptional()
  @IsInt()
  @Min(0)
  yMm?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  zMm?: number;

  @ApiPropertyOptional({ example: 90 })
  @IsOptional()
  @IsInt()
  @Min(0)
  rotationDeg?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  locked?: boolean;
}
