import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';

@ApiTags('audit')
@Controller('audit-events')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOkResponse({ description: 'Lists audit events for one entity reference.' })
  findByEntity(@Query('entityType') entityType?: string, @Query('entityId') entityId?: string) {
    return this.auditService.findByEntity(entityType, entityId);
  }
}
