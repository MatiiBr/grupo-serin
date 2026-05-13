import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { UpsertTruckDto } from './dto/upsert-truck.dto';
import { TrucksService } from './trucks.service';

@ApiTags('trucks')
@Controller('operations/:operationId/truck')
export class TrucksController {
  constructor(private readonly trucksService: TrucksService) {}

  @Put()
  @ApiOkResponse({ description: 'Creates or updates an operation truck with default zones.' })
  upsert(@Param('operationId', ParseUUIDPipe) operationId: string, @Body() dto: UpsertTruckDto) {
    return this.trucksService.upsertForOperation(operationId, dto);
  }

  @Get()
  @ApiOkResponse({ description: 'Returns the operation truck.' })
  findOne(@Param('operationId', ParseUUIDPipe) operationId: string) {
    return this.trucksService.findForOperation(operationId);
  }
}
