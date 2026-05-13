import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateTrailerCatalogDto, CreateTruckCatalogDto, UpdateTrailerCatalogDto, UpdateTruckCatalogDto, UpsertOperationVehicleAssignmentDto } from './dto/upsert-truck.dto';
import { TrucksService } from './trucks.service';

@ApiTags('trucks')
@Controller()
export class TrucksController {
  constructor(private readonly trucksService: TrucksService) {}

  @Post('trucks')
  @ApiCreatedResponse({ description: 'Creates a reusable truck catalog record.' })
  createTruckCatalog(@Body() dto: CreateTruckCatalogDto) {
    return this.trucksService.createTruckCatalog(dto);
  }

  @Get('trucks')
  @ApiOkResponse({ description: 'Searches reusable truck catalog records.' })
  searchTruckCatalog(@Query('q') q?: string) {
    return this.trucksService.searchTruckCatalog(q);
  }

  @Patch('trucks/:id')
  @ApiOkResponse({ description: 'Updates a truck catalog record.' })
  updateTruckCatalog(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTruckCatalogDto) {
    return this.trucksService.updateTruckCatalog(id, dto);
  }

  @Delete('trucks/:id')
  @ApiOkResponse({ description: 'Deletes a truck catalog record.' })
  removeTruckCatalog(@Param('id', ParseUUIDPipe) id: string) {
    return this.trucksService.removeTruckCatalog(id);
  }

  @Post('trailers')
  @ApiCreatedResponse({ description: 'Creates a reusable trailer catalog record.' })
  createTrailerCatalog(@Body() dto: CreateTrailerCatalogDto) {
    return this.trucksService.createTrailerCatalog(dto);
  }

  @Get('trailers')
  @ApiOkResponse({ description: 'Searches reusable trailer catalog records.' })
  searchTrailerCatalog(@Query('q') q?: string) {
    return this.trucksService.searchTrailerCatalog(q);
  }

  @Patch('trailers/:id')
  @ApiOkResponse({ description: 'Updates a trailer catalog record.' })
  updateTrailerCatalog(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTrailerCatalogDto) {
    return this.trucksService.updateTrailerCatalog(id, dto);
  }

  @Delete('trailers/:id')
  @ApiOkResponse({ description: 'Deletes a trailer catalog record.' })
  removeTrailerCatalog(@Param('id', ParseUUIDPipe) id: string) {
    return this.trucksService.removeTrailerCatalog(id);
  }

  @Put('operations/:operationId/vehicle')
  @ApiOkResponse({ description: 'Creates or updates an operation vehicle assignment with zones.' })
  upsert(@Param('operationId', ParseUUIDPipe) operationId: string, @Body() dto: UpsertOperationVehicleAssignmentDto) {
    return this.trucksService.upsertForOperation(operationId, dto);
  }

  @Get('operations/:operationId/vehicle')
  @ApiOkResponse({ description: 'Returns the operation vehicle assignment.' })
  findOne(@Param('operationId', ParseUUIDPipe) operationId: string) {
    return this.trucksService.findForOperation(operationId);
  }
}
