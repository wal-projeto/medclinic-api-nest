import { Inject, Injectable } from '@nestjs/common';
import {
  And,
  FindOptionsWhere,
  LessThan,
  MoreThanOrEqual,
  Not,
  Repository,
} from 'typeorm';
import { MAX_INTEGER } from '../@common/database/postgres-limits';
import { Doctor } from '../doctor/doctor.entity';
import { Appointment } from './appointment.entity';
import {
  AppointmentFilter,
  AppointmentPage,
  AppointmentRepository,
  AssertFree,
  LOOKBACK_MS,
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

  // TUDO NA MESMA TRANSAÇÃO, com a linha do médico travada: BEGIN, SELECT ... FOR UPDATE (médico), as duas buscas, o INSERT e COMMIT.
  // Se assertFree lançar, o ROLLBACK desfaz e o erro sobe; a trava é solta no COMMIT ou no ROLLBACK
  createWithLock(
    data: NewAppointment,
    assertFree: AssertFree,
  ): Promise<Appointment> {
    return this.repository.manager.transaction(async (manager) => {
      // 1º comando: SELECT ... FROM doctor WHERE id = $1 FOR UPDATE. Quem chegar depois, para o MESMO médico, espera aqui
      await manager.findOne(Doctor, {
        where: { id: data.doctorId },
        lock: { mode: 'pessimistic_write' },
      });

      // as consultas ativas que COMEÇAM em [um dia antes do início, fim da nova): o fim fica de fora
      const window: FindOptionsWhere<Appointment> = {
        status: Not('cancelled'), // consulta cancelada não ocupa o horário
        startsAt: And(
          MoreThanOrEqual(new Date(data.startsAt.getTime() - LOOKBACK_MS)),
          LessThan(data.endsAt),
        ),
      };
      // ATENÇÃO: tudo aqui dentro usa o manager DA TRANSAÇÃO (e não this.repository, que rodaria fora dela)
      const doctorAppointments = await manager.find(Appointment, {
        where: { ...window, doctorId: data.doctorId },
      });
      const patientAppointments = await manager.find(Appointment, {
        where: { ...window, patientId: data.patientId },
      });

      assertFree(doctorAppointments, patientAppointments); // lança 409 se alguma se sobrepõe

      // INSERT INTO appointment (...) VALUES (...) RETURNING id, created_at, updated_at
      return manager.save(manager.create(Appointment, data));
    });
  }

  // SELECT ... WHERE doctor_id = $1 AND status <> 'cancelled' AND starts_at >= $2 AND starts_at < $3 ORDER BY starts_at, id.
  // Não precisa de transação: é só leitura
  findActiveByDoctorInPeriod(
    doctorId: number,
    from: Date,
    to: Date,
  ): Promise<Appointment[]> {
    return this.repository.find({
      where: {
        doctorId,
        status: Not('cancelled'), // consulta cancelada não ocupa o horário (não aparece na agenda)
        startsAt: And(MoreThanOrEqual(from), LessThan(to)), // o dia seguinte à meia-noite fica de fora
      },
      order: { startsAt: 'ASC', id: 'ASC' }, // a mais cedo primeiro; no empate, a mais antiga
    });
  }

  // SELECT ... WHERE (só os filtros que vieram) ORDER BY starts_at, id LIMIT take OFFSET skip, mais o COUNT do total
  async findPage({
    doctorId,
    patientId,
    status,
    from,
    to,
    skip,
    take,
  }: AppointmentFilter): Promise<AppointmentPage> {
    // só entram na condição os filtros que vieram (o TypeORM recusa campo com valor undefined dentro do where)
    const where: FindOptionsWhere<Appointment> = {};
    if (doctorId !== undefined) where.doctorId = doctorId;
    if (patientId !== undefined) where.patientId = patientId;
    if (status !== undefined) where.status = status;
    // o período pode ter só o começo, só o fim ou os dois
    if (from && to) where.startsAt = And(MoreThanOrEqual(from), LessThan(to));
    else if (from) where.startsAt = MoreThanOrEqual(from);
    else if (to) where.startsAt = LessThan(to);

    const [appointments, total] = await this.repository.findAndCount({
      where,
      order: { startsAt: 'ASC', id: 'ASC' }, // a mais cedo primeiro; no empate, a mais antiga
      skip,
      take,
    });
    return { appointments, total };
  }

  // SELECT ... WHERE id = $1 LIMIT 1. Número que não cabe num integer do banco: null sem consultar (vira 404)
  findById(id: number): Promise<Appointment | null> {
    if (id < 1 || id > MAX_INTEGER) {
      // 0, -1, 99999999999 → entra no if
      return Promise.resolve(null);
    }
    return this.repository.findOne({ where: { id } }); // O que acontece: SELECT ... WHERE id = $1 LIMIT 1. Com valor: findOne({ where: { id: 7 } }) → a consulta 7, ou null
  }
}
