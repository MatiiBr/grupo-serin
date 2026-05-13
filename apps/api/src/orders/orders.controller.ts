import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('customers')
  @ApiCreatedResponse({ description: 'Creates a customer for manual order intake.' })
  createCustomer(@Body() dto: CreateCustomerDto, @Headers('x-actor') actor?: string) {
    return this.ordersService.createCustomer(dto, actor);
  }

  @Get('customers')
  @ApiOkResponse({ description: 'Searches customers available for order intake.' })
  searchCustomers(@Query('q') q?: string) {
    return this.ordersService.searchCustomers(q);
  }

  @Patch('customers/:id')
  @ApiOkResponse({ description: 'Updates a customer.' })
  updateCustomer(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCustomerDto, @Headers('x-actor') actor?: string) {
    return this.ordersService.updateCustomer(id, dto, actor);
  }

  @Post('orders')
  @ApiCreatedResponse({ description: 'Creates a manual customer order with item demand.' })
  createOrder(@Body() dto: CreateOrderDto, @Headers('x-actor') actor?: string) {
    return this.ordersService.createOrder(dto, actor);
  }

  @Get('orders')
  @ApiOkResponse({ description: 'Lists customer orders.' })
  findOrders() {
    return this.ordersService.findOrders();
  }

  @Get('orders/dispatch-demand')
  @ApiOkResponse({ description: 'Lists released orders eligible to feed dispatch planning.' })
  findDispatchDemand() {
    return this.ordersService.findDispatchDemand();
  }

  @Get('orders/:id')
  @ApiOkResponse({ description: 'Gets one customer order with item demand.' })
  findOrder(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.findOrder(id);
  }

  @Post('orders/:id/credit-hold')
  @ApiOkResponse({ description: 'Places an order on credit hold.' })
  holdCredit(@Param('id', ParseUUIDPipe) id: string, @Headers('x-actor') actor?: string) {
    return this.ordersService.holdCredit(id, actor);
  }

  @Post('orders/:id/credit-release')
  @ApiOkResponse({ description: 'Releases an order for dispatch demand.' })
  releaseCredit(@Param('id', ParseUUIDPipe) id: string, @Headers('x-actor') actor?: string) {
    return this.ordersService.releaseCredit(id, actor);
  }
}
