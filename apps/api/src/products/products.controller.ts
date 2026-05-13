import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post('operations/:operationId/products')
  @ApiCreatedResponse({ description: 'Creates an operation product.' })
  create(@Param('operationId', ParseUUIDPipe) operationId: string, @Body() dto: CreateProductDto) {
    return this.productsService.create(operationId, dto);
  }

  @Get('operations/:operationId/products')
  @ApiOkResponse({ description: 'Lists products for an operation.' })
  findForOperation(@Param('operationId', ParseUUIDPipe) operationId: string) {
    return this.productsService.findForOperation(operationId);
  }

  @Patch('products/:id')
  @ApiOkResponse({ description: 'Updates a product.' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete('products/:id')
  @ApiOkResponse({ description: 'Deletes a product.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.remove(id);
  }

  @Post('products/:id/duplicate')
  @ApiCreatedResponse({ description: 'Duplicates a product in the same operation.' })
  duplicate(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.duplicate(id);
  }
}
