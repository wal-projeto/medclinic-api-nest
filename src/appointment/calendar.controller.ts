// Responsabilidade: é a "porta de entrada" HTTP da agenda do médico: recebe a requisição, entrega o trabalho ao service
// e devolve o resultado. Não tem regra nenhuma. Qualquer perfil autenticado pode consultar.

import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CalendarQueryDto } from './dtos/calendar-query.dto';

@Controller('doctors') // api/v1/doctors (a agenda é um pedaço da rota do médico: /doctors/:id/calendar)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get(':id/calendar') // GET /api/v1/doctors/:id/calendar?from=2026-10-12&to=2026-10-16 : admin, secretary e doctor (sem @RequireRole, basta estar autenticado)
  findByDoctor(
    @Param('id', ParseIntPipe) id: number, // "3" → 3; "abc" → 400
    @Query() query: CalendarQueryDto, // from e to já validados pelo pipe (formato e data que existe)
  ) {
    return this.calendarService.findByDoctor(id, query);
  }
}
