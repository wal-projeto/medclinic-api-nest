import { describe, it, expect, beforeEach } from 'vitest';
import { AppException } from '../@common/exceptions/app.exception';
import { Doctor } from '../doctor/doctor.entity';
import { DoctorPage, DoctorRepository } from '../doctor/doctor.repository';
import {
  NewWorkShift,
  WorkScheduleRepository,
} from '../doctor/work-schedule.repository';
import { WorkScheduleService } from '../doctor/work-schedule.service';
import { WorkShift } from '../doctor/work-shift.entity';
import { Patient } from '../patient/patient.entity';
import { Appointment } from './appointment.entity';
import {
  AppointmentPage,
  AppointmentRepository,
  AssertFree,
  NewAppointment,
} from './appointment.repository';
import { AppointmentRulesService } from './appointment-rules.service';
import { CalendarService } from './calendar.service';

// FAKE DO MÉDICO: o WorkScheduleService só usa o findById; os outros métodos existem porque o implements obriga
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

  findByUserId(): Promise<Doctor | null> {
    return Promise.resolve(null);
  }
}

// FAKE DA ESCALA: devolve os turnos do médico (com a hora com segundos, como o banco devolve)
class WorkScheduleRepositoryFake implements WorkScheduleRepository {
  constructor(readonly shifts: WorkShift[]) {}

  replaceForDoctor(
    _doctorId: number,
    _shifts: NewWorkShift[],
  ): Promise<WorkShift[]> {
    return Promise.reject(new Error('não usado'));
  }

  findByDoctorId(doctorId: number): Promise<WorkShift[]> {
    return Promise.resolve(this.shifts.filter((s) => s.doctorId === doctorId));
  }
}

// FAKE DAS CONSULTAS: guarda as que "já estão no banco" (stored). No findActiveByDoctorInPeriod faz o que o adaptador faz:
// do médico pedido, não canceladas, que COMEÇAM de from (incluído) até to (excluído), da mais cedo para a mais tarde
class AppointmentRepositoryFake implements AppointmentRepository {
  searches: { doctorId: number; from: Date; to: Date }[] = []; // cada busca que o service pediu

  constructor(readonly stored: Appointment[] = []) {}

  createWithLock(_data: NewAppointment, _assertFree: AssertFree) {
    return Promise.reject<Appointment>(new Error('não usado'));
  }

  findPage(): Promise<AppointmentPage> {
    return Promise.resolve({ appointments: [], total: 0 });
  }

  findById(): Promise<Appointment | null> {
    return Promise.resolve(null);
  }

  updateStatus(): Promise<boolean> {
    return Promise.resolve(false);
  }

  existsByDoctorAndPatient(): Promise<boolean> {
    return Promise.resolve(false);
  }

  findActiveByDoctorInPeriod(
    doctorId: number,
    from: Date,
    to: Date,
  ): Promise<Appointment[]> {
    this.searches.push({ doctorId, from, to });
    return Promise.resolve(
      this.stored
        .filter(
          (a) =>
            a.doctorId === doctorId &&
            a.status !== 'cancelled' &&
            a.startsAt >= from &&
            a.startsAt < to,
        )
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    );
  }
}

describe('CalendarService', () => {
  const agora = new Date('2026-11-04T12:00:00.000Z');
  const doctor = (id: number): Doctor => ({
    id,
    crm: `CRM-SC-1000${id}`,
    user: undefined as unknown as Doctor['user'],
    createdAt: agora,
    updatedAt: agora,
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
    id: number,
    doctorId: number,
    startsAt: string,
    endsAt: string,
    status: Appointment['status'] = 'scheduled',
  ): Appointment => ({
    id,
    doctorId,
    patientId: 10,
    startsAt: new Date(startsAt),
    endsAt: new Date(endsAt),
    status,
    doctor: undefined as unknown as Doctor,
    patient: undefined as unknown as Patient,
    createdAt: agora,
    updatedAt: agora,
  });

  // A Dra. Helena (médico 2) atende terça das 08:00 às 12:00 (30 min); o médico 3 existe e não tem escala
  const escala = [turno(2, 2, '08:00', '12:00', 30)];

  let appointments: AppointmentRepositoryFake;
  let service: CalendarService;

  // O WorkScheduleService é o de verdade; só as duas portas dele são falsas
  const montar = (stored: Appointment[] = []) => {
    appointments = new AppointmentRepositoryFake(stored);
    service = new CalendarService(
      new WorkScheduleService(
        new DoctorRepositoryFake([doctor(2), doctor(3)]),
        new WorkScheduleRepositoryFake(escala),
      ),
      appointments,
      new AppointmentRulesService(),
    );
  };

  beforeEach(() => montar());

  // Capturar o erro de uma chamada que deve falhar
  const falhar = async (chamada: () => Promise<unknown>) => {
    try {
      await chamada();
    } catch (err) {
      return err as AppException;
    }
  };

  // O caminho feliz: a escala no formato do contrato (hora sem segundos) e a consulta com cinco campos (sem doctorId)
  it('devolve a escala e as consultas do período', async () => {
    montar([
      marcada(41, 2, '2026-10-13T11:00:00.000Z', '2026-10-13T11:30:00.000Z'),
    ]);

    const result = await service.findByDoctor(2, {
      from: '2026-10-12',
      to: '2026-10-16',
    });

    expect(result).toEqual({
      workSchedule: {
        shifts: [
          {
            weekDay: 2,
            startTime: '08:00',
            endTime: '12:00',
            slotDurationMinutes: 30,
          },
        ],
      },
      appointments: [
        {
          id: 41,
          patientId: 10,
          startsAt: new Date('2026-10-13T11:00:00.000Z'),
          endsAt: new Date('2026-10-13T11:30:00.000Z'),
          status: 'scheduled',
        },
      ],
    });
  });

  // O service traduz os dias em instantes (meia-noite de São Paulo) e manda a busca com o médico certo
  it('busca as consultas da meia-noite de from até a meia-noite depois de to, no relógio de São Paulo', async () => {
    await service.findByDoctor(2, { from: '2026-10-12', to: '2026-10-16' });

    expect(appointments.searches).toEqual([
      {
        doctorId: 2,
        from: new Date('2026-10-12T03:00:00.000Z'),
        to: new Date('2026-10-17T03:00:00.000Z'),
      },
    ]);
  });

  // Consulta cancelada não aparece na agenda; a do outro médico também não
  it('não devolve consulta cancelada nem de outro médico', async () => {
    montar([
      marcada(1, 2, '2026-10-13T11:00:00.000Z', '2026-10-13T11:30:00.000Z'),
      marcada(
        2,
        2,
        '2026-10-13T11:30:00.000Z',
        '2026-10-13T12:00:00.000Z',
        'cancelled',
      ),
      marcada(3, 3, '2026-10-13T11:00:00.000Z', '2026-10-13T11:30:00.000Z'),
    ]);

    const result = await service.findByDoctor(2, {
      from: '2026-10-13',
      to: '2026-10-13',
    });

    expect(result.appointments.map((a) => a.id)).toEqual([1]);
  });

  // O período inclui o dia inteiro dos dois lados, e só eles: 23:59 de 13/10 (02:59Z do dia 14) entra; 00:00 de 14/10 (03:00Z) não
  it('inclui as consultas do último dia e deixa de fora as do dia seguinte', async () => {
    montar([
      marcada(1, 2, '2026-10-13T03:00:00.000Z', '2026-10-13T03:30:00.000Z'), // 00:00 do dia 13: entra
      marcada(2, 2, '2026-10-14T02:30:00.000Z', '2026-10-14T02:59:00.000Z'), // 23:30 do dia 13: entra
      marcada(3, 2, '2026-10-14T03:00:00.000Z', '2026-10-14T03:30:00.000Z'), // 00:00 do dia 14: fora
      marcada(4, 2, '2026-10-13T02:30:00.000Z', '2026-10-13T02:59:00.000Z'), // 23:30 do dia 12: fora
    ]);

    const result = await service.findByDoctor(2, {
      from: '2026-10-13',
      to: '2026-10-13',
    });

    expect(result.appointments.map((a) => a.id)).toEqual([1, 2]);
  });

  // A ordem é a do tempo, não a da gravação
  it('devolve as consultas da mais cedo para a mais tarde', async () => {
    montar([
      marcada(1, 2, '2026-10-15T11:00:00.000Z', '2026-10-15T11:30:00.000Z'),
      marcada(2, 2, '2026-10-13T11:00:00.000Z', '2026-10-13T11:30:00.000Z'),
    ]);

    const result = await service.findByDoctor(2, {
      from: '2026-10-12',
      to: '2026-10-16',
    });

    expect(result.appointments.map((a) => a.id)).toEqual([2, 1]);
  });

  // Médico sem escala e sem consultas é um 200 normal, com duas listas vazias (não 404)
  it('devolve listas vazias quando o médico não tem escala nem consultas', async () => {
    const result = await service.findByDoctor(3, {
      from: '2026-10-12',
      to: '2026-10-16',
    });

    expect(result).toEqual({ workSchedule: { shifts: [] }, appointments: [] });
  });

  // Médico que não existe: 404, e a busca das consultas nem acontece
  it('lança 404 quando o médico não existe', async () => {
    const erro = await falhar(() =>
      service.findByDoctor(99, { from: '2026-10-12', to: '2026-10-16' }),
    );

    expect(erro).toBeInstanceOf(AppException);
    expect(erro?.errorCode).toBe('RECURSO_NAO_ENCONTRADO');
    expect(erro?.message).toBe('Médico não encontrado');
    expect(appointments.searches).toHaveLength(0);
  });

  // Período inválido: 400, mesmo para um médico que não existe (a validação vem antes da busca)
  it('lança 400 quando o período é inválido, antes de procurar o médico', async () => {
    const erro = await falhar(() =>
      service.findByDoctor(99, { from: '2026-10-16', to: '2026-10-12' }),
    );

    expect(erro).toBeInstanceOf(AppException);
    expect(erro?.errorCode).toBe('DADOS_INVALIDOS');
    expect(appointments.searches).toHaveLength(0);
  });
});
