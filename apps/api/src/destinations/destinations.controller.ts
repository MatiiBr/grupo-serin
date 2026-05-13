import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DestinationsService } from './destinations.service';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { UpdateDestinationDto } from './dto/update-destination.dto';

@ApiTags('destinations')
@Controller()
export class DestinationsController {
  constructor(private readonly destinationsService: DestinationsService) {}

  @Post('operations/:operationId/destinations')
  @ApiCreatedResponse({ description: 'Creates an operation destination.' })
  create(@Param('operationId', ParseUUIDPipe) operationId: string, @Body() dto: CreateDestinationDto) {
    return this.destinationsService.create(operationId, dto);
  }

  @Get('operations/:operationId/destinations')
  @ApiOkResponse({ description: 'Lists destinations for an operation.' })
  findForOperation(@Param('operationId', ParseUUIDPipe) operationId: string) {
    return this.destinationsService.findForOperation(operationId);
  }

  @Patch('destinations/:id')
  @ApiOkResponse({ description: 'Updates a destination.' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDestinationDto) {
    return this.destinationsService.update(id, dto);
  }

  @Delete('destinations/:id')
  @ApiOkResponse({ description: 'Deletes a destination.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.destinationsService.remove(id);
  }
}
