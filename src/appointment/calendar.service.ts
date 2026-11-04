// Responsabilidade: monta a agenda do médico num período: a escala dele mais as consultas ativas do período.
// Não gera a lista de horários livres (quem desenha a grade é o front-end). Não sabe nada de banco nem de HTTP.

import { Injectable } from '@nestjs/common';
import { WorkScheduleService } from '../doctor/work-schedule.service';
import { Appointment } from './appointment.entity';
import { AppointmentRepository } from './appointment.repository';
import { AppointmentRulesService } from './appointment-rules.service';
import { CalendarQueryDto } from './dtos/calendar-query.dto';

@Injectable()
export class CalendarService {
  constructor(
    private readonly workScheduleService: WorkScheduleService, // já sabe devolver a escala no formato do contrato (e dizer 404 se o médico não existe)
    private readonly appointmentRepository: AppointmentRepository,
    private readonly rules: AppointmentRulesService, // a regra do período
  ) {}

  // A AGENDA DO MÉDICO NUM PERÍODO. Período inválido é 400; médico que não existe é 404; médico sem escala e sem consultas é 200 com listas vazias
  async findByDoctor(doctorId: number, query: CalendarQueryDto) {
    // 1) o período vira dois instantes (meia-noite de from até a meia-noite depois de to, no relógio de São Paulo). 400 se não vale
    const period = this.rules.resolveCalendarPeriod(query.from, query.to);

    // 2) a escala do médico, no mesmo formato da rota GET /work-schedule. Lança o 404 se o médico não existe
    const workSchedule =
      await this.workScheduleService.findByDoctorId(doctorId);

    // 3) as consultas ativas (não canceladas) que começam no período, da mais cedo para a mais tarde
    const appointments =
      await this.appointmentRepository.findActiveByDoctorInPeriod(
        doctorId,
        period.startsAt,
        period.endsAt,
      );

    return {
      workSchedule,
      appointments: appointments.map((appointment) =>
        this.toResponse(appointment),
      ),
    };
  }

  // O contrato: cinco campos por consulta (sem doctorId: o médico já é o da URL; sem doctor, patient, createdAt e updatedAt)
  private toResponse(appointment: Appointment) {
    return {
      id: appointment.id,
      patientId: appointment.patientId,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      status: appointment.status,
    };
  }
}
