import { Body, Controller, Post } from '@nestjs/common';
import { RequireRole } from '../auth/decorator/require-role.decorator';
import { AppointmentService } from './appointment.service';
import { CreateAppointmentDto } from './dtos/create-appointment.dto';

@Controller('appointments') // api/v1/appointments
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Post() // POST /api/v1/appointments : admin e secretary; doctor → 403. O Nest responde 201 por padrão no POST
  @RequireRole(['admin', 'secretary'])
  create(@Body() body: CreateAppointmentDto) {
    return this.appointmentService.create(body);
  }
}
