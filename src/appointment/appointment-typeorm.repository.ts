import { Inject, Injectable } from '@nestjs/common';
import { And, LessThan, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { Appointment } from './appointment.entity';
import {
  AppointmentRepository,
  NewAppointment,
} from './appointment.repository';

// etiqueta que injeta o repositório do TypeORM
export const TYPEORM_APPOINTMENT_REPOSITORY =
  'TYPEORM_APPOINTMENT_REPOSITORY' as const;

@Injectable()
export class AppointmentTypeormRepository implements AppointmentRepository {
  constructor(
    @Inject(TYPEORM_APPOINTMENT_REPOSITORY)
    private readonly repository: Repository<Appointment>,
  ) {}

  // SELECT ... FROM appointment WHERE doctor_id = 2 AND status <> 'cancelled' AND starts_at >= from AND starts_at < to
  findActiveByDoctor(
    doctorId: number,
    from: Date,
    to: Date,
  ): Promise<Appointment[]> {
    return this.repository.find({
      where: {
        doctorId,
        status: Not('cancelled'), // consulta cancelada não ocupa o horário
        startsAt: And(MoreThanOrEqual(from), LessThan(to)), // [from, to): o fim fica de fora
      },
    });
  }

  // o mesmo, pelo paciente
  findActiveByPatient(
    patientId: number,
    from: Date,
    to: Date,
  ): Promise<Appointment[]> {
    return this.repository.find({
      where: {
        patientId,
        status: Not('cancelled'),
        startsAt: And(MoreThanOrEqual(from), LessThan(to)),
      },
    });
  }

  // INSERT INTO appointment (...) VALUES (...) RETURNING id, created_at, updated_at
  create(data: NewAppointment): Promise<Appointment> {
    return this.repository.save(this.repository.create(data));
  }
}
