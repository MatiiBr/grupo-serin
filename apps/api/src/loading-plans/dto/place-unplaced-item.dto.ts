import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class PlaceUnplacedItemDto {
  @ApiProperty({ example: 1200 })
  @IsInt()
  @Min(0)
  xMm!: number;

  @ApiProperty({ example: 300 })
  @IsInt()
  @Min(0)
  yMm!: number;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  zMm!: number;

  @ApiProperty({ example: 90 })
  @IsInt()
  @Min(0)
  rotationDeg!: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  locked?: boolean;
}
