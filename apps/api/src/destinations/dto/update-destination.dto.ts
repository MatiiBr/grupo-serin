import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { CreateDestinationCatalogDto, CreateOperationDestinationAssignmentDto } from './create-destination.dto';

export class UpdateDestinationCatalogDto extends PartialType(CreateDestinationCatalogDto) {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateOperationDestinationAssignmentDto extends PartialType(CreateOperationDestinationAssignmentDto) {}

export class UpdateDestinationDto extends UpdateDestinationCatalogDto {}

export class ReorderOperationDestinationsDto {
  @ApiPropertyOptional({ example: ['550e8400-e29b-41d4-a716-446655440000'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids!: string[];
}
