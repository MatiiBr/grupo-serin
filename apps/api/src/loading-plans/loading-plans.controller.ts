import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RequireRoles } from '../auth/require-roles.decorator';
import { AuthRole } from '../auth/roles';
import { PlaceUnplacedItemDto } from './dto/place-unplaced-item.dto';
import { UpdatePlacedItemDto } from './dto/update-placed-item.dto';
import { LoadingPlansService } from './loading-plans.service';

@ApiTags('loading-plans')
@Controller()
export class LoadingPlansController {
  constructor(private readonly loadingPlansService: LoadingPlansService) {}

  @Post('operations/:operationId/loading-plans/generate')
  @ApiCreatedResponse({ description: 'Generates and persists a loading plan for an operation.' })
  generate(@Param('operationId', ParseUUIDPipe) operationId: string) {
    return this.loadingPlansService.generate(operationId);
  }

  @Get('operations/:operationId/loading-plans/current')
  @ApiOkResponse({ description: 'Returns the current loading plan for an operation.' })
  findCurrent(@Param('operationId', ParseUUIDPipe) operationId: string) {
    return this.loadingPlansService.findCurrent(operationId);
  }

  @Get('loading-plans/:id')
  @ApiOkResponse({ description: 'Returns a loading plan by id.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.loadingPlansService.findOne(id);
  }

  @Post('loading-plans/:planId/approve')
  @RequireRoles(AuthRole.LOADING_SUPERVISOR, AuthRole.LOGISTICS_MANAGER)
  @ApiOkResponse({ description: 'Approves a valid loading plan and its parent operation.' })
  approve(@Param('planId', ParseUUIDPipe) planId: string, @Headers('x-actor') actor?: string) {
    return this.loadingPlansService.approve(planId, actor);
  }

  @Get('loading-plans/:planId/report')
  @ApiOkResponse({ description: 'Returns printable operational report data for a loading plan.' })
  report(@Param('planId', ParseUUIDPipe) planId: string) {
    return this.loadingPlansService.report(planId);
  }

  @Patch('loading-plans/:planId/placed-items/:placedItemId')
  @RequireRoles(AuthRole.LOADING_SUPERVISOR, AuthRole.LOGISTICS_MANAGER)
  @ApiOkResponse({ description: 'Manually adjusts a placed item and recalculates plan validation.' })
  updatePlacedItem(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('placedItemId', ParseUUIDPipe) placedItemId: string,
    @Body() dto: UpdatePlacedItemDto,
    @Headers('x-actor') actor?: string,
  ) {
    return this.loadingPlansService.updatePlacedItem(planId, placedItemId, dto, actor);
  }

  @Post('loading-plans/:planId/unplaced-items/:unplacedItemId/place')
  @RequireRoles(AuthRole.LOADING_SUPERVISOR, AuthRole.LOGISTICS_MANAGER)
  @ApiOkResponse({ description: 'Manually places an unplaced item and recalculates plan validation.' })
  placeUnplacedItem(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('unplacedItemId', ParseUUIDPipe) unplacedItemId: string,
    @Body() dto: PlaceUnplacedItemDto,
    @Headers('x-actor') actor?: string,
  ) {
    return this.loadingPlansService.placeUnplacedItem(planId, unplacedItemId, dto, actor);
  }
}
