import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateOperationProductAssignmentDto, CreateProductCatalogDto } from './dto/create-product.dto';
import { UpdateOperationProductAssignmentDto, UpdateProductCatalogDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post('products')
  @ApiCreatedResponse({ description: 'Creates a reusable product catalog record.' })
  createCatalog(@Body() dto: CreateProductCatalogDto) {
    return this.productsService.createCatalog(dto);
  }

  @Get('products')
  @ApiOkResponse({ description: 'Searches reusable product catalog records.' })
  searchCatalog(@Query('q') q?: string) {
    return this.productsService.searchCatalog(q);
  }

  @Patch('products/:id')
  @ApiOkResponse({ description: 'Updates a product catalog record.' })
  updateCatalog(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductCatalogDto) {
    return this.productsService.updateCatalog(id, dto);
  }

  @Delete('products/:id')
  @ApiOkResponse({ description: 'Deletes a product catalog record.' })
  removeCatalog(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.removeCatalog(id);
  }

  @Post('operations/:operationId/products')
  @ApiCreatedResponse({ description: 'Assigns a product catalog record to an operation.' })
  create(@Param('operationId', ParseUUIDPipe) operationId: string, @Body() dto: CreateOperationProductAssignmentDto) {
    return this.productsService.create(operationId, dto);
  }

  @Get('operations/:operationId/products')
  @ApiOkResponse({ description: 'Lists product assignments for an operation.' })
  findForOperation(@Param('operationId', ParseUUIDPipe) operationId: string) {
    return this.productsService.findForOperation(operationId);
  }

  @Patch('operation-products/:id')
  @ApiOkResponse({ description: 'Updates an operation product assignment.' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOperationProductAssignmentDto) {
    return this.productsService.update(id, dto);
  }

  @Delete('operation-products/:id')
  @ApiOkResponse({ description: 'Deletes an operation product assignment.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.remove(id);
  }
}
