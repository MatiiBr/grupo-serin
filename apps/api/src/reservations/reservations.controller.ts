import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RequireRoles } from '../auth/require-roles.decorator';
import { AuthRole } from '../auth/roles';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ReservationsService } from './reservations.service';

@ApiTags('reservations')
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  @RequireRoles(AuthRole.WAREHOUSE_OPERATOR, AuthRole.LOGISTICS_MANAGER)
  @ApiCreatedResponse({ description: 'Requests inventory reservation against dispatch demand and records unmet quantity for reprocess.' })
  createReservation(@Body() dto: CreateReservationDto, @Headers('x-actor') actor?: string) {
    return this.reservationsService.createReservation(dto, actor);
  }

  @Get()
  @ApiOkResponse({ description: 'Lists inventory reservations.' })
  findReservations() {
    return this.reservationsService.findReservations();
  }

  @Get('reprocess')
  @ApiOkResponse({ description: 'Lists partial reservations with unmet quantity requiring reprocess.' })
  findReprocessReservations() {
    return this.reservationsService.findReprocessReservations();
  }

  @Post(':id/release')
  @RequireRoles(AuthRole.WAREHOUSE_OPERATOR, AuthRole.LOGISTICS_MANAGER)
  @ApiOkResponse({ description: 'Releases a reservation explicitly.' })
  release(@Param('id', ParseUUIDPipe) id: string, @Headers('x-actor') actor?: string) {
    return this.reservationsService.release(id, actor);
  }
}
