import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { BlockTransportExitDto, CreateTransportExitDto, MarkTransportDocsReadyDto, RecordTransportScaleDto } from './dto/transport-exit.dto';
import { TransportService } from './transport.service';

@ApiTags('transport')
@Controller('transport/exits')
export class TransportController {
  constructor(private readonly transportService: TransportService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Creates the transport exit gate for a dispatch order.' })
  createExit(@Body() dto: CreateTransportExitDto, @Headers('x-actor') actor?: string) {
    return this.transportService.createExit(dto, actor);
  }

  @Post(':id/docs-ready')
  @ApiOkResponse({ description: 'Marks dispatch transport documents ready for exit.' })
  markDocsReady(@Param('id') id: string, @Body() dto: MarkTransportDocsReadyDto, @Headers('x-actor') actor?: string) {
    return this.transportService.markDocsReady(id, dto, actor);
  }

  @Post(':id/scale')
  @ApiOkResponse({ description: 'Records the transport scale result required before exit authorization.' })
  recordScale(@Param('id') id: string, @Body() dto: RecordTransportScaleDto, @Headers('x-actor') actor?: string) {
    return this.transportService.recordScale(id, dto, actor);
  }

  @Post(':id/authorize')
  @ApiOkResponse({ description: 'Authorizes exit after approved loading plan, documents, and scale are present.' })
  authorizeExit(@Param('id') id: string, @Headers('x-actor') actor?: string) {
    return this.transportService.authorizeExit(id, actor);
  }

  @Post(':id/dispatch')
  @ApiOkResponse({ description: 'Records final dispatch after exit authorization.' })
  markDispatched(@Param('id') id: string, @Headers('x-actor') actor?: string) {
    return this.transportService.markDispatched(id, actor);
  }

  @Post(':id/block')
  @ApiOkResponse({ description: 'Blocks transport exit until the issue is resolved.' })
  blockExit(@Param('id') id: string, @Body() dto: BlockTransportExitDto, @Headers('x-actor') actor?: string) {
    return this.transportService.blockExit(id, dto, actor);
  }

  @Get()
  @ApiOkResponse({ description: 'Lists transport exit gates.' })
  findExits() {
    return this.transportService.findExits();
  }
}
