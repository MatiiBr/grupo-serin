import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { OperationStatus } from '@prisma/client';

@ApiTags('health')
@Controller()
export class AppController {
  @Get('health')
  @ApiOkResponse({
    description: 'API health status.',
    schema: {
      example: {
        status: 'ok',
        service: 'camiones-api',
        defaultOperationStatus: OperationStatus.DRAFT,
      },
    },
  })
  health() {
    return {
      status: 'ok',
      service: 'camiones-api',
      defaultOperationStatus: OperationStatus.DRAFT,
    };
  }
}
