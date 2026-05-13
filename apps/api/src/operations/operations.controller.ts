import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateOperationDto } from './dto/create-operation.dto';
import { OperationsService } from './operations.service';

@ApiTags('operations')
@Controller('operations')
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Creates a loading operation.' })
  create(@Body() dto: CreateOperationDto) {
    return this.operationsService.create(dto);
  }

  @Get()
  @ApiOkResponse({ description: 'Lists loading operations.' })
  findAll() {
    return this.operationsService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Returns operation detail.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.operationsService.findOne(id);
  }
}
