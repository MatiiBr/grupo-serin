import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateDestinationCatalogDto, CreateOperationDestinationAssignmentDto } from './create-destination.dto';

export class UpdateDestinationCatalogDto extends PartialType(CreateDestinationCatalogDto) {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateOperationDestinationAssignmentDto extends PartialType(CreateOperationDestinationAssignmentDto) {}

export class UpdateDestinationDto extends UpdateDestinationCatalogDto {}
