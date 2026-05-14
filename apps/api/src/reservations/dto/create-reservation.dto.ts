import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class ReservationAvailabilityDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  @IsUUID()
  dispatchOrderItemId!: string;

  @ApiProperty({ example: 6, minimum: 0 })
  @IsInt()
  @Min(0)
  availableQuantity!: number;
}

export class CreateReservationDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID()
  dispatchOrderId!: string;

  @ApiProperty({ type: [ReservationAvailabilityDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReservationAvailabilityDto)
  availability!: ReservationAvailabilityDto[];

  @ApiPropertyOptional({ example: 'INV-RES-123' })
  @IsOptional()
  @IsString()
  externalRef?: string;

  @ApiPropertyOptional({ example: 'Reserva tentativa contra stock externo.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
