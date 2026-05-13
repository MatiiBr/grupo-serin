import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DestinationsService } from './destinations.service';
import { CreateDestinationCatalogDto, CreateOperationDestinationAssignmentDto } from './dto/create-destination.dto';
import { UpdateDestinationCatalogDto, UpdateOperationDestinationAssignmentDto } from './dto/update-destination.dto';

@ApiTags('destinations')
@Controller()
export class DestinationsController {
  constructor(private readonly destinationsService: DestinationsService) {}

  @Post('destinations')
  @ApiCreatedResponse({ description: 'Creates a reusable destination catalog record.' })
  createCatalog(@Body() dto: CreateDestinationCatalogDto) {
    return this.destinationsService.createCatalog(dto);
  }

  @Get('destinations')
  @ApiOkResponse({ description: 'Searches reusable destination catalog records.' })
  searchCatalog(@Query('q') q?: string) {
    return this.destinationsService.searchCatalog(q);
  }

  @Patch('destinations/:id')
  @ApiOkResponse({ description: 'Updates a destination catalog record.' })
  updateCatalog(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDestinationCatalogDto) {
    return this.destinationsService.updateCatalog(id, dto);
  }

  @Delete('destinations/:id')
  @ApiOkResponse({ description: 'Deletes a destination catalog record.' })
  removeCatalog(@Param('id', ParseUUIDPipe) id: string) {
    return this.destinationsService.removeCatalog(id);
  }

  @Post('operations/:operationId/destinations')
  @ApiCreatedResponse({ description: 'Assigns a destination catalog record to an operation.' })
  create(@Param('operationId', ParseUUIDPipe) operationId: string, @Body() dto: CreateOperationDestinationAssignmentDto) {
    return this.destinationsService.create(operationId, dto);
  }

  @Get('operations/:operationId/destinations')
  @ApiOkResponse({ description: 'Lists destination assignments for an operation.' })
  findForOperation(@Param('operationId', ParseUUIDPipe) operationId: string) {
    return this.destinationsService.findForOperation(operationId);
  }

  @Patch('operation-destinations/:id')
  @ApiOkResponse({ description: 'Updates an operation destination assignment.' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOperationDestinationAssignmentDto) {
    return this.destinationsService.update(id, dto);
  }

  @Delete('operation-destinations/:id')
  @ApiOkResponse({ description: 'Deletes an operation destination assignment.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.destinationsService.remove(id);
  }
}
