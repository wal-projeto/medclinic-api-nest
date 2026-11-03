import { Injectable } from '@nestjs/common';
import { AppException } from '../@common/exceptions/app.exception';
import { DoctorRepository } from '../doctor/doctor.repository';
import { WorkScheduleRepository } from '../doctor/work-schedule.repository';
import { PatientRepository } from '../patient/patient.repository';
import { Appointment } from './appointment.entity';
import { AppointmentRepository } from './appointment.repository';
import { AppointmentRulesService } from './appointment-rules.service';
import { CreateAppointmentDto } from './dtos/create-appointment.dto';

// Nenhuma consulta dura mais de 1440 minutos (um dia): quem se sobrepõe a uma consulta nova começou, no máximo, um dia antes dela
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AppointmentService {
  constructor(
    private readonly doctorRepository: DoctorRepository, // para conferir se o médico existe
    private readonly patientRepository: PatientRepository, // para conferir se o paciente existe
    private readonly workScheduleRepository: WorkScheduleRepository, // para ler os turnos do médico
    private readonly appointmentRepository: AppointmentRepository,
    private readonly rules: AppointmentRulesService, // as regras de horário
  ) {}

  // MARCA UMA CONSULTA
  async create(input: CreateAppointmentDto) {
    const startsAt = new Date(input.startsAt); // "2026-10-13T08:00:00-03:00" → o instante 11:00 UTC

    // 1) o médico e o paciente existem (404)
    if (!(await this.doctorRepository.findById(input.doctorId))) {
      throw new AppException('RECURSO_NAO_ENCONTRADO', 'Médico não encontrado');
    }
    if (!(await this.patientRepository.findById(input.patientId))) {
      throw new AppException(
        'RECURSO_NAO_ENCONTRADO',
        'Paciente não encontrado',
      );
    }

    // 2, 3 e 4) o horário cai num turno, na grade e cabe no turno (422). Devolve o fim da consulta
    const shifts = await this.workScheduleRepository.findByDoctorId(
      input.doctorId,
    );
    const endsAt = this.rules.resolveEndsAt(shifts, startsAt);
    const period = { startsAt, endsAt };
    const from = new Date(startsAt.getTime() - DAY_MS);

    // 5) o médico está livre no período (409)
    const doctorAppointments =
      await this.appointmentRepository.findActiveByDoctor(
        input.doctorId,
        from,
        endsAt,
      );
    if (this.rules.hasOverlap(doctorAppointments, period)) {
      throw new AppException(
        'HORARIO_INDISPONIVEL',
        'O médico já tem uma consulta nesse horário',
      );
    }

    // 6) o paciente está livre no período, ainda que com outro médico (409)
    const patientAppointments =
      await this.appointmentRepository.findActiveByPatient(
        input.patientId,
        from,
        endsAt,
      );
    if (this.rules.hasOverlap(patientAppointments, period)) {
      throw new AppException(
        'PACIENTE_INDISPONIVEL',
        'O paciente já tem uma consulta nesse horário',
      );
    }

    const saved = await this.appointmentRepository.create({
      doctorId: input.doctorId,
      patientId: input.patientId,
      startsAt,
      endsAt,
      status: 'scheduled', // toda consulta nasce agendada
    });
    return this.toResponse(saved);
  }

  // O contrato: só os seis campos (sem doctor, patient, createdAt e updatedAt). As datas saem em UTC (ISO) no JSON
  private toResponse(appointment: Appointment) {
    return {
      id: appointment.id,
      doctorId: appointment.doctorId,
      patientId: appointment.patientId,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      status: appointment.status,
    };
  }
}
