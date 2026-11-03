import { describe, it, expect, beforeEach } from 'vitest';
import { AppException } from '../@common/exceptions/app.exception';
import { Doctor } from '../doctor/doctor.entity';
import { DoctorPage, DoctorRepository } from '../doctor/doctor.repository';
import {
  NewWorkShift,
  WorkScheduleRepository,
} from '../doctor/work-schedule.repository';
import { WorkShift } from '../doctor/work-shift.entity';
import { Patient } from '../patient/patient.entity';
import { PatientPage, PatientRepository } from '../patient/patient.repository';
import { Appointment } from './appointment.entity';
import {
  AppointmentRepository,
  NewAppointment,
} from './appointment.repository';
import { AppointmentRulesService } from './appointment-rules.service';
import { AppointmentService } from './appointment.service';

// FAKE DO MÉDICO: o service só usa o findById; os outros métodos existem porque o implements obriga
class DoctorRepositoryFake implements DoctorRepository {
  constructor(readonly doctors: Doctor[]) {}

  findById(id: number): Promise<Doctor | null> {
    return Promise.resolve(this.doctors.find((d) => d.id === id) ?? null);
  }

  existsByCrm(): Promise<boolean> {
    return Promise.resolve(false);
  }

  createWithUser(): Promise<Doctor> {
    return Promise.reject(new Error('não usado'));
  }

  findPage(): Promise<DoctorPage> {
    return Promise.resolve({ doctors: [], total: 0 });
  }
}

// FAKE DO PACIENTE: o service só usa o findById
class PatientRepositoryFake implements PatientRepository {
  constructor(readonly patients: Patient[]) {}

  findById(id: number): Promise<Patient | null> {
    return Promise.resolve(this.patients.find((p) => p.id === id) ?? null);
  }

  existsByCpf(): Promise<boolean> {
    return Promise.resolve(false);
  }

  create(): Promise<Patient> {
    return Promise.reject(new Error('não usado'));
  }

  findPage(): Promise<PatientPage> {
    return Promise.resolve({ patients: [], total: 0 });
  }

  save(): Promise<Patient> {
    return Promise.reject(new Error('não usado'));
  }

  softDelete(): Promise<void> {
    return Promise.resolve();
  }
}

// FAKE DA ESCALA: devolve os turnos do médico (com a hora com segundos, como o banco devolve)
class WorkScheduleRepositoryFake implements WorkScheduleRepository {
  lookups = 0; // quantas vezes o service pediu a escala

  constructor(readonly shifts: WorkShift[]) {}

  replaceForDoctor(
    _doctorId: number,
    _shifts: NewWorkShift[],
  ): Promise<WorkShift[]> {
    return Promise.reject(new Error('não usado'));
  }

  findByDoctorId(doctorId: number): Promise<WorkShift[]> {
    this.lookups++;
    return Promise.resolve(this.shifts.filter((s) => s.doctorId === doctorId));
  }
}

// FAKE DAS CONSULTAS: guarda as que "já estão no banco" (stored), devolve as ativas do médico ou do paciente
// que COMEÇAM em [from, to) e anota a consulta que o service mandou gravar (created)
class AppointmentRepositoryFake implements AppointmentRepository {
  created?: NewAppointment;

  constructor(readonly stored: Appointment[] = []) {}

  findActiveByDoctor(doctorId: number, from: Date, to: Date) {
    return Promise.resolve(
      this.stored.filter(
        (a) =>
          a.doctorId === doctorId &&
          a.status !== 'cancelled' &&
          a.startsAt >= from &&
          a.startsAt < to,
      ),
    );
  }

  findActiveByPatient(patientId: number, from: Date, to: Date) {
    return Promise.resolve(
      this.stored.filter(
        (a) =>
          a.patientId === patientId &&
          a.status !== 'cancelled' &&
          a.startsAt >= from &&
          a.startsAt < to,
      ),
    );
  }

  create(data: NewAppointment): Promise<Appointment> {
    this.created = data;
    return Promise.resolve({
      ...data,
      id: 41,
      doctor: undefined as unknown as Doctor,
      patient: undefined as unknown as Patient,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

describe('AppointmentService', () => {
  const agora = new Date('2026-11-03T20:00:00.000Z');
  const doctor = (id: number): Doctor => ({
    id,
    crm: `CRM-SC-1000${id}`,
    user: undefined as unknown as Doctor['user'],
    createdAt: agora,
    updatedAt: agora,
  });
  const patient = (id: number): Patient => ({
    id,
    name: `Paciente ${id}`,
    cpf: `0000000000${id}`,
    createdAt: agora,
    updatedAt: agora,
    deletedAt: null,
  });
  // Um turno como o banco devolve: com segundos
  const turno = (
    doctorId: number,
    weekDay: number,
    startTime: string,
    endTime: string,
    slotDurationMinutes: number,
  ): WorkShift => ({
    id: 1,
    doctorId,
    weekDay,
    startTime: `${startTime}:00`,
    endTime: `${endTime}:00`,
    slotDurationMinutes,
    doctor: undefined as unknown as Doctor,
  });
  // Uma consulta que já está marcada
  const marcada = (
    doctorId: number,
    patientId: number,
    startsAt: string,
    endsAt: string,
    status: Appointment['status'] = 'scheduled',
  ): Appointment => ({
    id: 7,
    doctorId,
    patientId,
    startsAt: new Date(startsAt),
    endsAt: new Date(endsAt),
    status,
    doctor: undefined as unknown as Doctor,
    patient: undefined as unknown as Patient,
    createdAt: agora,
    updatedAt: agora,
  });

  // A Dra. Helena (médico 2) atende terça das 08:00 às 12:00 (30 min) e das 14:00 às 18:00 (20 min), e sexta das 08:00 às 11:45 (30 min); os pacientes são 10 e 11
  const escalaDaHelena = [
    turno(2, 2, '08:00', '12:00', 30),
    turno(2, 2, '14:00', '18:00', 20),
    turno(2, 5, '08:00', '11:45', 30),
  ];
  const corpo = (startsAt: string, patientId = 10) => ({
    doctorId: 2,
    patientId,
    startsAt,
  });

  let appointments: AppointmentRepositoryFake;
  let schedule: WorkScheduleRepositoryFake;
  let service: AppointmentService;

  const montar = (stored: Appointment[] = []) => {
    appointments = new AppointmentRepositoryFake(stored);
    schedule = new WorkScheduleRepositoryFake(escalaDaHelena);
    service = new AppointmentService(
      new DoctorRepositoryFake([doctor(2)]),
      new PatientRepositoryFake([patient(10), patient(11)]),
      schedule,
      appointments,
      new AppointmentRulesService(),
    );
  };

  beforeEach(() => montar());

  // O caminho feliz: terça 08:00 (-03:00) = 11:00 UTC; o fim é 11:30 UTC (30 minutos do turno); nasce scheduled
  it('marca a consulta e devolve os seis campos do contrato, com o fim calculado', async () => {
    const resultado = await service.create(corpo('2026-10-13T08:00:00-03:00'));

    expect(resultado).toEqual({
      id: 41,
      doctorId: 2,
      patientId: 10,
      startsAt: new Date('2026-10-13T11:00:00.000Z'),
      endsAt: new Date('2026-10-13T11:30:00.000Z'),
      status: 'scheduled',
    });
    expect(appointments.created).toEqual({
      doctorId: 2,
      patientId: 10,
      startsAt: new Date('2026-10-13T11:00:00.000Z'),
      endsAt: new Date('2026-10-13T11:30:00.000Z'),
      status: 'scheduled',
    });
  });

  // 1) Médico ou paciente que não existe: 404, e nada é gravado
  it('lança RECURSO_NAO_ENCONTRADO quando o médico não existe', async () => {
    const erro = await service
      .create({ ...corpo('2026-10-13T08:00:00-03:00'), doctorId: 999 })
      .catch((err) => err);

    expect(erro).toBeInstanceOf(AppException);
    expect(erro.errorCode).toBe('RECURSO_NAO_ENCONTRADO');
    expect(erro.message).toBe('Médico não encontrado');
    expect(appointments.created).toBeUndefined();
  });

  it('lança RECURSO_NAO_ENCONTRADO quando o paciente não existe e não consulta a escala', async () => {
    const erro = await service
      .create(corpo('2026-10-13T08:00:00-03:00', 999))
      .catch((err) => err);

    expect(erro).toBeInstanceOf(AppException);
    expect(erro.errorCode).toBe('RECURSO_NAO_ENCONTRADO');
    expect(erro.message).toBe('Paciente não encontrado');
    expect(schedule.lookups).toBe(0);
    expect(appointments.created).toBeUndefined();
  });

  // 2, 3 e 4) Horário que não existe na agenda do médico: 422, e nada é gravado. O trecho da mensagem mostra qual das três regras falhou
  it.each([
    [
      'fora de qualquer turno (quarta-feira)',
      '2026-10-14T08:00:00-03:00',
      'nenhum turno',
    ],
    ['desalinhado da grade (08:10)', '2026-10-13T08:10:00-03:00', 'grade'],
    [
      'que não cabe no fim do turno (sexta 11:30, o turno acaba às 11:45)',
      '2026-10-16T11:30:00-03:00',
      'não cabe',
    ],
  ])(
    'lança HORARIO_FORA_DA_ESCALA para horário %s',
    async (_caso, startsAt, trecho) => {
      const erro = await service.create(corpo(startsAt)).catch((err) => err);

      expect(erro).toBeInstanceOf(AppException);
      expect(erro.errorCode).toBe('HORARIO_FORA_DA_ESCALA');
      expect(erro.message).toContain(trecho);
      expect(appointments.created).toBeUndefined();
    },
  );

  // 5) O médico já tem uma consulta no período: 409 HORARIO_INDISPONIVEL
  it('lança HORARIO_INDISPONIVEL quando o médico já tem consulta nesse horário', async () => {
    montar([
      marcada(2, 11, '2026-10-13T11:00:00.000Z', '2026-10-13T11:30:00.000Z'),
    ]);

    const erro = await service
      .create(corpo('2026-10-13T08:00:00-03:00'))
      .catch((err) => err);

    expect(erro).toBeInstanceOf(AppException);
    expect(erro.errorCode).toBe('HORARIO_INDISPONIVEL');
    expect(appointments.created).toBeUndefined();
  });

  // O início é diferente, mas há sobreposição: a consulta antiga (de uma escala antiga) dura 60 min e vai até 09:00 (12:00Z)
  it('lança HORARIO_INDISPONIVEL quando a consulta existente começa antes e invade o novo horário', async () => {
    montar([
      marcada(2, 11, '2026-10-13T11:00:00.000Z', '2026-10-13T12:00:00.000Z'),
    ]);

    const erro = await service
      .create(corpo('2026-10-13T08:30:00-03:00'))
      .catch((err) => err);

    expect(erro).toBeInstanceOf(AppException);
    expect(erro.errorCode).toBe('HORARIO_INDISPONIVEL');
  });

  // 6) O paciente já tem uma consulta no período, com OUTRO médico: 409 PACIENTE_INDISPONIVEL
  it('lança PACIENTE_INDISPONIVEL quando o paciente já tem consulta nesse horário com outro médico', async () => {
    montar([
      marcada(3, 10, '2026-10-13T11:00:00.000Z', '2026-10-13T11:30:00.000Z'),
    ]);

    const erro = await service
      .create(corpo('2026-10-13T08:00:00-03:00'))
      .catch((err) => err);

    expect(erro).toBeInstanceOf(AppException);
    expect(erro.errorCode).toBe('PACIENTE_INDISPONIVEL');
    expect(appointments.created).toBeUndefined();
  });

  // Se os dois conflitam, vale a ordem do contrato: o médico primeiro
  it('lança HORARIO_INDISPONIVEL, e não PACIENTE_INDISPONIVEL, quando o médico e o paciente conflitam', async () => {
    montar([
      marcada(2, 10, '2026-10-13T11:00:00.000Z', '2026-10-13T11:30:00.000Z'),
    ]);

    const erro = await service
      .create(corpo('2026-10-13T08:00:00-03:00'))
      .catch((err) => err);

    expect(erro.errorCode).toBe('HORARIO_INDISPONIVEL');
  });

  // Encostadas não conflitam (a existente termina às 11:00Z, quando a nova começa)
  it('marca a consulta que começa quando a anterior do médico termina', async () => {
    montar([
      marcada(2, 11, '2026-10-13T10:30:00.000Z', '2026-10-13T11:00:00.000Z'),
    ]);

    const resultado = await service.create(corpo('2026-10-13T08:00:00-03:00'));

    expect(resultado.status).toBe('scheduled');
  });

  // Consulta cancelada não ocupa o horário (a porta só devolve as ativas)
  it('marca a consulta quando a do mesmo horário foi cancelada', async () => {
    montar([
      marcada(
        2,
        11,
        '2026-10-13T11:00:00.000Z',
        '2026-10-13T11:30:00.000Z',
        'cancelled',
      ),
    ]);

    const resultado = await service.create(corpo('2026-10-13T08:00:00-03:00'));

    expect(resultado.endsAt).toEqual(new Date('2026-10-13T11:30:00.000Z'));
  });
});
