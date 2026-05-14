import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CustomsService } from './customs.service';
import { BlockCustomsReleaseDto, ClearCustomsReleaseDto, CreateCustomsReleaseDto } from './dto/customs-release.dto';

@ApiTags('customs')
@Controller('customs/releases')
export class CustomsController {
  constructor(private readonly customsService: CustomsService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Registers a customs checkpoint required before dispatch can load.' })
  createRelease(@Body() dto: CreateCustomsReleaseDto, @Headers('x-actor') actor?: string) {
    return this.customsService.createRelease(dto, actor);
  }

  @Post(':id/clear')
  @ApiOkResponse({ description: 'Clears a customs checkpoint so dispatch can proceed to loading.' })
  clearRelease(@Param('id') id: string, @Body() dto: ClearCustomsReleaseDto, @Headers('x-actor') actor?: string) {
    return this.customsService.clearRelease(id, dto, actor);
  }

  @Post(':id/block')
  @ApiOkResponse({ description: 'Blocks a customs checkpoint and keeps dispatch pending.' })
  blockRelease(@Param('id') id: string, @Body() dto: BlockCustomsReleaseDto, @Headers('x-actor') actor?: string) {
    return this.customsService.blockRelease(id, dto, actor);
  }

  @Get()
  @ApiOkResponse({ description: 'Lists customs checkpoints.' })
  findReleases() {
    return this.customsService.findReleases();
  }

  @Get('pending')
  @ApiOkResponse({ description: 'Lists pending or blocked customs checkpoints.' })
  findPendingReleases() {
    return this.customsService.findPendingReleases();
  }
}
