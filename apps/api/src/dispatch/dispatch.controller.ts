import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DispatchService } from './dispatch.service';
import { CreateDeliveryPlanDto } from './dto/create-delivery-plan.dto';
import { CreateDispatchOrderDto } from './dto/create-dispatch-order.dto';

@ApiTags('dispatch')
@Controller('dispatch')
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @Post('delivery-plans')
  @ApiCreatedResponse({ description: 'Creates a delivery plan foundation record.' })
  createDeliveryPlan(@Body() dto: CreateDeliveryPlanDto) {
    return this.dispatchService.createDeliveryPlan(dto);
  }

  @Get('delivery-plans')
  @ApiOkResponse({ description: 'Lists delivery plans.' })
  findDeliveryPlans() {
    return this.dispatchService.findDeliveryPlans();
  }

  @Post('dispatch-orders')
  @ApiCreatedResponse({ description: 'Creates a dispatch order from eligible released order demand.' })
  createDispatchOrder(@Body() dto: CreateDispatchOrderDto) {
    return this.dispatchService.createDispatchOrder(dto);
  }

  @Get('dispatch-orders')
  @ApiOkResponse({ description: 'Lists dispatch orders.' })
  findDispatchOrders() {
    return this.dispatchService.findDispatchOrders();
  }

  @Post('dispatch-orders/:id/ready')
  @ApiOkResponse({ description: 'Marks a dispatch order snapshot ready for loading.' })
  markReady(@Param('id', ParseUUIDPipe) id: string) {
    return this.dispatchService.markReady(id);
  }

  @Post('dispatch-orders/:id/load-operation')
  @ApiCreatedResponse({ description: 'Creates or returns the load operation snapshot for a ready dispatch order.' })
  createLoadOperation(@Param('id', ParseUUIDPipe) id: string) {
    return this.dispatchService.createLoadOperation(id);
  }
}
