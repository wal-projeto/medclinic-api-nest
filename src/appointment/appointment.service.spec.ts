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
import type { AuthUser } from '../auth/jwt.service';
import { Appointment } from './appointment.entity';
import {
  AppointmentFilter,
  AppointmentPage,
  AppointmentRepository,
  AssertFree,
  LOOKBACK_MS,
  NewAppointment,
} from './appointment.repository';
import { AppointmentRulesService } from './appointment-rules.service';
import { AppointmentService } from './appointment.service';
import { ListAppointmentsQueryDto } from './dtos/list-appointments-query.dto';

// FAKE DO MÉDICO: o service só usa o findById; os outros métodos existem porque o implements obriga
class DoctorRepositoryFake implements DoctorRepository {
  constructor(readonly doctors: Doctor[]) {}

  findById(id: number): Promise<Doctor | null> {
    return Promise.resolve(this.doctors.find((d) => d.id === id) ?? null);
  }

  // o médico do usuário de acesso (o doctor() abaixo põe o usuário 100 + id no médico)
  findByUserId(userId: number): Promise<Doctor | null> {
    return Promise.resolve(
      this.doctors.find((d) => d.user.id === userId) ?? null,
    );
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

// FAKE DAS CONSULTAS: guarda as que "já estão no banco" (stored). No createWithLock faz o que o adaptador faz (separa as ativas
// do médico e do paciente que COMEÇAM entre um dia antes do início e o fim da nova), chama a regra de conflito do service
// e, só se ela não lançar, anota a consulta que o service mandou gravar (created)
class AppointmentRepositoryFake implements AppointmentRepository {
  created?: NewAppointment;
  locks = 0; // quantas vezes o service pediu a gravação com a trava (uma por consulta que chegou até a transação)

  constructor(readonly stored: Appointment[] = []) {}

  createWithLock(
    data: NewAppointment,
    assertFree: AssertFree,
  ): Promise<Appointment> {
    this.locks++;
    const from = new Date(data.startsAt.getTime() - LOOKBACK_MS);
    const candidates = this.stored.filter(
      (a) =>
        a.status !== 'cancelled' &&
        a.startsAt >= from &&
        a.startsAt < data.endsAt,
    );
    try {
      assertFree(
        candidates.filter((a) => a.doctorId === data.doctorId),
        candidates.filter((a) => a.patientId === data.patientId),
      );
    } catch (err) {
      return Promise.reject(err as Error);
    }
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

  findActiveByDoctorInPeriod(): Promise<Appointment[]> {
    return Promise.reject(new Error('não usado'));
  }

  // a listagem: anota cada pedido (pages) e faz o que o banco faria: filtra, ordena por início (e id) e fatia por skip e take
  pages: AppointmentFilter[] = [];

  findPage(filter: AppointmentFilter): Promise<AppointmentPage> {
    this.pages.push(filter);
    const casam = this.stored
      .filter(
        (a) =>
          (filter.doctorId === undefined || a.doctorId === filter.doctorId) &&
          (filter.patientId === undefined ||
            a.patientId === filter.patientId) &&
          (filter.status === undefined || a.status === filter.status) &&
          (!filter.from || a.startsAt >= filter.from) &&
          (!filter.to || a.startsAt < filter.to),
      )
      .sort(
        (a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.id - b.id,
      );
    return Promise.resolve({
      appointments: casam.slice(filter.skip, filter.skip + filter.take),
      total: casam.length,
    });
  }

  // a consulta pelo número: a que está guardada com esse id, ou null
  findById(id: number): Promise<Appointment | null> {
    return Promise.resolve(this.stored.find((a) => a.id === id) ?? null);
  }
}

describe('AppointmentService', () => {
  const agora = new Date('2026-11-03T20:00:00.000Z');
  const doctor = (id: number): Doctor => ({
    id,
    crm: `CRM-SC-1000${id}`,
    user: { id: 100 + id } as unknown as Doctor['user'],
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
    id = 7,
  ): Appointment => ({
    id,
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
    expect(appointments.locks).toBe(1); // uma gravação, uma transação
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
    expect(appointments.locks).toBe(0); // a transação nem foi aberta
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
    expect(appointments.locks).toBe(0);
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
      expect(appointments.locks).toBe(0); // horário que não existe na escala não chega a travar o médico
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
    expect(appointments.locks).toBe(1); // o conflito é descoberto DENTRO da transação, com o médico travado
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

  describe('list', () => {
    // a query como o pipe entrega: page e pageSize sempre vêm (com o padrão), o resto só se veio na URL
    const query = (extra: Partial<ListAppointmentsQueryDto> = {}) => ({
      page: 1,
      pageSize: 20,
      ...extra,
    });
    const admin: AuthUser = { id: 1, roles: ['admin'] };
    const secretary: AuthUser = { id: 2, roles: ['secretary'] };
    const helena: AuthUser = { id: 102, roles: ['doctor'] }; // o usuário da Dra. Helena (médico 2)
    // três consultas: duas da Helena (2) e uma do médico 3, fora da ordem de início
    const tresConsultas = () => [
      marcada(
        2,
        11,
        '2026-10-15T11:00:00.000Z',
        '2026-10-15T11:30:00.000Z',
        'scheduled',
        3,
      ),
      marcada(
        2,
        10,
        '2026-10-13T11:00:00.000Z',
        '2026-10-13T11:30:00.000Z',
        'scheduled',
        1,
      ),
      marcada(
        3,
        10,
        '2026-10-14T11:00:00.000Z',
        '2026-10-14T11:30:00.000Z',
        'done',
        2,
      ),
    ];

    // O caminho feliz: da mais cedo para a mais tarde, só os seis campos, e o meta da paginação
    it('devolve a página, da mais cedo para a mais tarde, com os seis campos de cada consulta', async () => {
      montar(tresConsultas());

      const resultado = await service.list(query(), admin);

      expect(resultado.data.map((a) => a.id)).toEqual([1, 2, 3]);
      expect(Object.keys(resultado.data[0])).toEqual([
        'id',
        'doctorId',
        'patientId',
        'startsAt',
        'endsAt',
        'status',
      ]);
      expect(resultado.meta).toEqual({
        total: 3,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
    });

    // Os filtros chegam à porta como vieram, e o período vira dois instantes (dias inteiros, no relógio de São Paulo)
    it('repassa os filtros e converte from e to em instantes', async () => {
      await service.list(
        query({
          doctorId: 2,
          patientId: 10,
          status: 'scheduled',
          from: '2026-10-12',
          to: '2026-10-16',
        }),
        admin,
      );

      expect(appointments.pages).toEqual([
        {
          doctorId: 2,
          patientId: 10,
          status: 'scheduled',
          from: new Date('2026-10-12T03:00:00.000Z'),
          to: new Date('2026-10-17T03:00:00.000Z'),
          skip: 0,
          take: 20,
        },
      ]);
    });

    // O período pode ter só um dos lados; o que não veio não vira filtro
    it('aceita só o from ou só o to', async () => {
      await service.list(query({ from: '2026-10-12' }), admin);
      await service.list(query({ to: '2026-10-16' }), admin);

      expect(appointments.pages[0].from).toEqual(
        new Date('2026-10-12T03:00:00.000Z'),
      );
      expect(appointments.pages[0].to).toBeUndefined();
      expect(appointments.pages[1].from).toBeUndefined();
      expect(appointments.pages[1].to).toEqual(
        new Date('2026-10-17T03:00:00.000Z'),
      );
    });

    // A conta da paginação: a página 2 de tamanho 2 pula 2 e pega 2
    it('transforma page e pageSize em skip e take e devolve o meta', async () => {
      montar(tresConsultas());

      const resultado = await service.list(
        query({ page: 2, pageSize: 2 }),
        admin,
      );

      expect(appointments.pages[0].skip).toBe(2);
      expect(appointments.pages[0].take).toBe(2);
      expect(resultado.data.map((a) => a.id)).toEqual([3]);
      expect(resultado.meta).toEqual({
        total: 3,
        page: 2,
        pageSize: 2,
        totalPages: 2,
      });
    });

    // Nada casa: a lista vazia é um 200 normal, com totalPages 0
    it('devolve a lista vazia quando nenhuma consulta casa', async () => {
      const resultado = await service.list(query({ status: 'done' }), admin);

      expect(resultado.data).toEqual([]);
      expect(resultado.meta).toEqual({
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      });
    });

    // A secretaria e o admin enxergam as consultas de todos os médicos
    it('não limita a secretaria a um médico', async () => {
      montar(tresConsultas());

      const resultado = await service.list(query(), secretary);

      expect(appointments.pages[0].doctorId).toBeUndefined();
      expect(resultado.data).toHaveLength(3);
    });

    // O filtro forçado por perfil: o doctor só vê as consultas do próprio médico, mesmo sem mandar nada
    it('limita o doctor às consultas do próprio médico', async () => {
      montar(tresConsultas());

      const resultado = await service.list(query(), helena);

      expect(appointments.pages[0].doctorId).toBe(2);
      expect(resultado.data.map((a) => a.id)).toEqual([1, 3]);
      expect(resultado.data.every((a) => a.doctorId === 2)).toBe(true);
    });

    it('deixa o doctor pedir o próprio médico', async () => {
      montar(tresConsultas());

      const resultado = await service.list(query({ doctorId: 2 }), helena);

      expect(resultado.data.map((a) => a.id)).toEqual([1, 3]);
    });

    // Pedir o médico de outro não vaza nada: lista vazia, e a busca nem acontece
    it('devolve a lista vazia quando o doctor pede o médico de outro, sem consultar', async () => {
      montar(tresConsultas());

      const resultado = await service.list(query({ doctorId: 3 }), helena);

      expect(resultado.data).toEqual([]);
      expect(resultado.meta.total).toBe(0);
      expect(appointments.pages).toHaveLength(0);
    });

    // Usuário doctor que não tem registro de médico (por exemplo, criado pelo POST /users): não há o que listar
    it('devolve a lista vazia quando o doctor não tem registro de médico, sem consultar', async () => {
      montar(tresConsultas());

      const resultado = await service.list(query(), {
        id: 555,
        roles: ['doctor'],
      });

      expect(resultado.data).toEqual([]);
      expect(appointments.pages).toHaveLength(0);
    });

    // Quem tem os dois perfis (doctor e admin) não é limitado: o admin vence
    it('não limita quem é doctor e admin ao mesmo tempo', async () => {
      montar(tresConsultas());

      const resultado = await service.list(query(), {
        id: 102,
        roles: ['doctor', 'admin'],
      });

      expect(appointments.pages[0].doctorId).toBeUndefined();
      expect(resultado.data).toHaveLength(3);
    });

    // from depois de to: 400, antes de qualquer busca
    it('lança 400 quando from é depois de to, sem consultar', async () => {
      const erro = await service
        .list(query({ from: '2026-10-16', to: '2026-10-12' }), admin)
        .catch((err) => err);

      expect(erro).toBeInstanceOf(AppException);
      expect(erro.errorCode).toBe('DADOS_INVALIDOS');
      expect(erro.message).toBe('from must not be after to');
      expect(appointments.pages).toHaveLength(0);
    });
  });

  describe('findById', () => {
    const admin: AuthUser = { id: 1, roles: ['admin'] };
    const secretary: AuthUser = { id: 2, roles: ['secretary'] };
    const helena: AuthUser = { id: 102, roles: ['doctor'] }; // o usuário da Dra. Helena (médico 2)
    // duas consultas: a 1 é da Helena (médico 2) e a 2 é do médico 3
    const duasConsultas = () => [
      marcada(
        2,
        10,
        '2026-10-13T11:00:00.000Z',
        '2026-10-13T11:30:00.000Z',
        'scheduled',
        1,
      ),
      marcada(
        3,
        11,
        '2026-10-14T11:00:00.000Z',
        '2026-10-14T11:30:00.000Z',
        'cancelled',
        2,
      ),
    ];

    // O caminho feliz: os seis campos do contrato, e a cancelada também aparece (consultar não é listar as ativas)
    it('devolve a consulta com os seis campos do contrato', async () => {
      montar(duasConsultas());

      const resultado = await service.findById(2, admin);

      expect(resultado).toEqual({
        id: 2,
        doctorId: 3,
        patientId: 11,
        startsAt: new Date('2026-10-14T11:00:00.000Z'),
        endsAt: new Date('2026-10-14T11:30:00.000Z'),
        status: 'cancelled',
      });
    });

    it('deixa a secretaria consultar a consulta de qualquer médico', async () => {
      montar(duasConsultas());

      const resultado = await service.findById(2, secretary);

      expect(resultado.doctorId).toBe(3);
    });

    // O doctor consulta a consulta dele
    it('deixa o doctor consultar a própria consulta', async () => {
      montar(duasConsultas());

      const resultado = await service.findById(1, helena);

      expect(resultado.doctorId).toBe(2);
    });

    // A consulta de outro médico: 403 ACESSO_NEGADO
    it('lança ACESSO_NEGADO quando o doctor pede a consulta de outro médico', async () => {
      montar(duasConsultas());

      const erro = await service.findById(2, helena).catch((err) => err);

      expect(erro).toBeInstanceOf(AppException);
      expect(erro.errorCode).toBe('ACESSO_NEGADO');
    });

    // Usuário doctor sem registro de médico não é o médico de nenhuma consulta
    it('lança ACESSO_NEGADO quando o doctor não tem registro de médico', async () => {
      montar(duasConsultas());

      const erro = await service
        .findById(1, { id: 555, roles: ['doctor'] })
        .catch((err) => err);

      expect(erro).toBeInstanceOf(AppException);
      expect(erro.errorCode).toBe('ACESSO_NEGADO');
    });

    // Quem tem os dois perfis (doctor e admin) não é limitado: o admin vence
    it('deixa quem é doctor e admin consultar a consulta de outro médico', async () => {
      montar(duasConsultas());

      const resultado = await service.findById(2, {
        id: 102,
        roles: ['doctor', 'admin'],
      });

      expect(resultado.doctorId).toBe(3);
    });

    // A consulta não existe: 404 para todos, inclusive para o doctor (o 404 vem antes do 403)
    it('lança RECURSO_NAO_ENCONTRADO quando a consulta não existe', async () => {
      montar(duasConsultas());

      const erroAdmin = await service.findById(99, admin).catch((err) => err);
      const erroDoctor = await service.findById(99, helena).catch((err) => err);

      expect(erroAdmin).toBeInstanceOf(AppException);
      expect(erroAdmin.errorCode).toBe('RECURSO_NAO_ENCONTRADO');
      expect(erroDoctor.errorCode).toBe('RECURSO_NAO_ENCONTRADO');
    });
  });
});
