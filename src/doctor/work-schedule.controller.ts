// Responsabilidade: é a "porta de entrada" HTTP da escala: recebe a requisição,
// diz qual perfil pode (só o admin troca a escala; qualquer perfil autenticado consulta)
// e entrega o trabalho ao service. Não tem regra nenhuma.

import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import { RequireRole } from '../auth/decorator/require-role.decorator';
import { SetWorkScheduleDto } from './dtos/set-work-schedule.dto';
import { WorkScheduleService } from './work-schedule.service';

@Controller('doctors') // api/v1/doctors (a escala é um pedaço da rota do médico: /doctors/:id/work-schedule)
export class WorkScheduleController {
  constructor(private readonly workScheduleService: WorkScheduleService) {}

  @Put(':id/work-schedule') // PUT /api/v1/doctors/:id/work-schedule : só admin; secretary e doctor → 403. O Nest responde 200 por padrão no PUT
  @RequireRole(['admin']) // só o admin passa pelo Guard; secretary e doctor → 403
  replace(
    @Param('id', ParseIntPipe) id: number, // pega o :id como número. "2" → 2; "abc" → 400
    @Body() body: SetWorkScheduleDto, // o corpo já validado pelo pipe (formato de cada turno)
  ) {
    return this.workScheduleService.replace(id, body);
  }

  @Get(':id/work-schedule') // GET /api/v1/doctors/:id/work-schedule : admin, secretary e doctor podem consultar a escala de qualquer médico
  findByDoctorId(@Param('id', ParseIntPipe) id: number) {
    return this.workScheduleService.findByDoctorId(id);
  }
}
