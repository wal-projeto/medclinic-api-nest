import { Injectable } from '@nestjs/common';
import { Appointment } from './appointment.entity';

// NewAppointment = só os campos que mandamos gravar. O id e as datas de criação o banco preenche
export type NewAppointment = Pick<
  Appointment,
  'doctorId' | 'patientId' | 'startsAt' | 'endsAt' | 'status'
>;

// PORTA
@Injectable()
export abstract class AppointmentRepository {
  // "as consultas deste médico que não foram canceladas e que COMEÇAM de from (inclusive) até to (exclusive)"
  abstract findActiveByDoctor(
    doctorId: number,
    from: Date,
    to: Date,
  ): Promise<Appointment[]>;

  // o mesmo, para o paciente
  abstract findActiveByPatient(
    patientId: number,
    from: Date,
    to: Date,
  ): Promise<Appointment[]>;

  // "grave esta consulta e me devolva ela completa, com o id"
  abstract create(data: NewAppointment): Promise<Appointment>;
}
