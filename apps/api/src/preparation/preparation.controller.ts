import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RequireRoles } from '../auth/require-roles.decorator';
import { AuthRole } from '../auth/roles';
import { CreatePreparationDto } from './dto/create-preparation.dto';
import { PreparationService } from './preparation.service';

@ApiTags('preparation')
@Controller('preparation')
export class PreparationController {
  constructor(private readonly preparationService: PreparationService) {}

  @Post()
  @RequireRoles(AuthRole.WAREHOUSE_OPERATOR, AuthRole.LOGISTICS_MANAGER)
  @ApiCreatedResponse({ description: 'Records warehouse preparation readiness from fully reserved demand.' })
  createPreparation(@Body() dto: CreatePreparationDto, @Headers('x-actor') actor?: string) {
    return this.preparationService.createPreparation(dto, actor);
  }

  @Get()
  @ApiOkResponse({ description: 'Lists warehouse preparations.' })
  findPreparations() {
    return this.preparationService.findPreparations();
  }

  @Get('discrepancies')
  @ApiOkResponse({ description: 'Lists preparations with discrepancies blocking loading readiness.' })
  findDiscrepancies() {
    return this.preparationService.findDiscrepancies();
  }
}
