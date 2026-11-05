import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { GetAuthUser } from '../auth/decorator/get-auth-user.decorator';
import { RequireRole } from '../auth/decorator/require-role.decorator';
import type { AuthUser } from '../auth/jwt.service';
import { AppointmentService } from './appointment.service';
import { CreateAppointmentDto } from './dtos/create-appointment.dto';
import { ListAppointmentsQueryDto } from './dtos/list-appointments-query.dto';

@Controller('appointments') // api/v1/appointments
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Post() // POST /api/v1/appointments : admin e secretary; doctor → 403. O Nest responde 201 por padrão no POST
  @RequireRole(['admin', 'secretary'])
  create(@Body() body: CreateAppointmentDto) {
    return this.appointmentService.create(body);
  }

  @Get() // GET /api/v1/appointments?doctorId=&patientId=&status=&from=&to=&page=&pageSize= : qualquer perfil autenticado (o doctor só vê as dele)
  list(
    @Query() query: ListAppointmentsQueryDto, // os filtros e a paginação já validados pelo pipe
    @GetAuthUser() user: AuthUser, // quem está pedindo: { id, roles }
  ) {
    return this.appointmentService.list(query, user);
  }
}
