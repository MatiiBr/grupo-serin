import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateOperationProductAssignmentDto, CreateProductCatalogDto } from './create-product.dto';

export class UpdateProductCatalogDto extends PartialType(CreateProductCatalogDto) {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateOperationProductAssignmentDto extends PartialType(CreateOperationProductAssignmentDto) {}

export class UpdateProductDto extends UpdateProductCatalogDto {}
