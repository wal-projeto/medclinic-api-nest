import { Get } from '@nestjs/common';
import { Controller } from '@nestjs/common';
import { PublicRoute } from './auth/decorator/public-route.decorator';

@Controller('health')
export class HealthController {
  @PublicRoute()
  @Get()
  getHealth(): { status: string } {
    return { status: 'ok' };
  }
}
