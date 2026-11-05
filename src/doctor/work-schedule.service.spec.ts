import { describe, it, expect } from 'vitest';
import { AppException } from '../@common/exceptions/app.exception';
import { Doctor } from './doctor.entity';
import { DoctorPage, DoctorRepository } from './doctor.repository';
import { SetWorkScheduleDto } from './dtos/set-work-schedule.dto';
import {
  NewWorkShift,
  WorkScheduleRepository,
} from './work-schedule.repository';
import { WorkScheduleService } from './work-schedule.service';
import { WorkShift } from './work-shift.entity';

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

// FAKE DA ESCALA: guarda os turnos que já "estão no banco" (stored), anota o que o service
// mandou gravar e devolve os turnos com id (e a hora com segundos, como o banco devolve ao ler)
class WorkScheduleRepositoryFake implements WorkScheduleRepository {
  lastDoctorId?: number;
  lastShifts?: NewWorkShift[];
  lookups = 0; // quantas vezes o service pediu a escala de um médico (findByDoctorId)

  // os turnos que "já estão no banco": o fake começa com eles (ou vazio, se eu não passar nada)
  constructor(readonly stored: WorkShift[] = []) {}

  replaceForDoctor(
    doctorId: number,
    shifts: NewWorkShift[],
  ): Promise<WorkShift[]> {
    this.lastDoctorId = doctorId;
    this.lastShifts = shifts;
    return Promise.resolve(
      shifts.map((shift, index) => ({
        ...shift,
        id: index + 1,
        doctorId,
        startTime: `${shift.startTime}:00`, // o banco devolve "08:00:00"
        endTime: `${shift.endTime}:00`,
        doctor: undefined as unknown as Doctor,
      })),
    );
  }

  findByDoctorId(doctorId: number): Promise<WorkShift[]> {
    // devolve só os turnos do médico pedido
    this.lookups++;
    return Promise.resolve(this.stored.filter((s) => s.doctorId === doctorId));
  }
}

//prova, sem banco e sem rede, que o WorkScheduleService devolve a escala no formato certo,
// devolve lista vazia quando não há escala e lança o 404 quando o médico não existe.
// Usa repositórios de mentira (fakes), em memória.
describe('WorkScheduleService', () => {
  const agora = new Date('2026-11-02T20:00:00.000Z');
  const helena: Doctor = {
    id: 2,
    crm: 'CRM-SC-10002',
    user: {
      id: 12,
      name: 'Dra. Helena Souza',
      email: 'helena@clinica.com',
      password: 'hash-qualquer',
      roles: ['doctor'],
      createdAt: agora,
      updatedAt: agora,
    },
    createdAt: agora,
    updatedAt: agora,
  };

  describe('replace', () => {
    // Um turno de terça (2), com a duração de 30 minutos
    const terca = (startTime: string, endTime: string, slot = 30) => ({
      weekDay: 2,
      startTime,
      endTime,
      slotDurationMinutes: slot,
    });
    let repository: WorkScheduleRepositoryFake;
    let service: WorkScheduleService;

    beforeEach(() => {
      repository = new WorkScheduleRepositoryFake();
      service = new WorkScheduleService(
        new DoctorRepositoryFake([helena]),
        repository,
      );
    });

    // O exemplo do Word: dois turnos na terça (com durações diferentes) e um na quinta. A resposta tem o formato do corpo, na ordem enviada
    it('grava a escala do médico e devolve os turnos no formato do contrato', async () => {
      const input = {
        shifts: [
          terca('08:00', '12:00', 30),
          terca('14:00', '18:00', 20),
          {
            weekDay: 4,
            startTime: '08:00',
            endTime: '11:00',
            slotDurationMinutes: 30,
          },
        ],
      } satisfies SetWorkScheduleDto;

      const resultado = await service.replace(2, input);

      expect(resultado).toEqual(input);
      expect(repository.lastDoctorId).toBe(2);
      expect(repository.lastShifts).toEqual(input.shifts);
    });

    // Encostados (um termina às 12:00 e o outro começa às 12:00) são aceitos, e o mesmo horário em dias diferentes também
    it('aceita turnos encostados e o mesmo horário em dias diferentes', async () => {
      const input = {
        shifts: [
          terca('08:00', '12:00'),
          terca('12:00', '18:00'),
          {
            weekDay: 3,
            startTime: '08:00',
            endTime: '12:00',
            slotDurationMinutes: 30,
          },
        ],
      } satisfies SetWorkScheduleDto;

      const resultado = await service.replace(2, input);

      expect(resultado.shifts).toHaveLength(3);
    });

    // A lista vazia é válida e apaga a escala: a porta é chamada com [] e a resposta é { shifts: [] }
    it('aceita a lista vazia, que apaga a escala', async () => {
      const resultado = await service.replace(2, { shifts: [] });

      expect(resultado).toEqual({ shifts: [] });
      expect(repository.lastShifts).toEqual([]);
    });

    // Sobreposição no mesmo dia: 400, mesmo quando os turnos chegam fora de ordem, e nada é gravado
    it.each([
      [
        'um começa antes de o outro terminar',
        [terca('08:00', '12:00'), terca('11:00', '15:00')],
      ],
      [
        'enviados fora de ordem',
        [terca('14:00', '18:00'), terca('08:00', '15:00')],
      ],
      [
        'um dentro do outro',
        [terca('08:00', '18:00'), terca('09:00', '10:00')],
      ],
    ])(
      'lança DADOS_INVALIDOS quando os turnos se sobrepõem (%s) e não grava nada',
      async (_caso, shifts) => {
        const erro = await service.replace(2, { shifts }).catch((err) => err);

        expect(erro).toBeInstanceOf(AppException);
        expect(erro.errorCode).toBe('DADOS_INVALIDOS');
        expect(repository.lastShifts).toBeUndefined();
      },
    );

    // Turno que começa quando (ou depois de) termina: 400
    it.each([
      ['começa depois de terminar', terca('12:00', '08:00')],
      ['começa e termina na mesma hora', terca('08:00', '08:00')],
    ])('lança DADOS_INVALIDOS quando o turno %s', async (_caso, turno) => {
      const erro = await service
        .replace(2, { shifts: [turno] })
        .catch((err) => err);

      expect(erro).toBeInstanceOf(AppException);
      expect(erro.errorCode).toBe('DADOS_INVALIDOS');
      expect(repository.lastShifts).toBeUndefined();
    });

    // Médico que não existe: 404, e nada é gravado
    it('lança RECURSO_NAO_ENCONTRADO quando o médico não existe e não grava nada', async () => {
      const erro = await service
        .replace(999, { shifts: [terca('08:00', '12:00')] })
        .catch((err) => err);

      expect(erro).toBeInstanceOf(AppException);
      expect(erro.errorCode).toBe('RECURSO_NAO_ENCONTRADO');
      expect(repository.lastShifts).toBeUndefined();
    });
  });

  // CONSULTA A ESCALA DO MÉDICO. Médico sem escala é 200 com { shifts: [] }; médico que não existe é 404
  describe('findByDoctorId', () => {
    // Monta três turnos(doBanco) como o banco devolveria: com id, doctorId e a hora com segundos "08:00:00"
    const turno = (
      id: number,
      weekDay: number,
      startTime: string,
      endTime: string,
      slotDurationMinutes: number,
    ): WorkShift => ({
      id,
      doctorId: 2,
      weekDay,
      startTime,
      endTime,
      slotDurationMinutes,
      doctor: undefined as unknown as Doctor,
    });
    const doBanco = [
      turno(1, 2, '08:00:00', '12:00:00', 30),
      turno(2, 2, '14:00:00', '18:00:00', 20),
      turno(3, 4, '08:00:00', '11:00:00', 30),
    ];

    // 1º TESTE: Devolve só os 4 campos de cada turno (sem id e sem doctorId) e a hora cortada para HH:MM
    it('devolve os turnos do médico só com os quatro campos e a hora em HH:MM', async () => {
      const service = new WorkScheduleService(
        new DoctorRepositoryFake([helena]),
        new WorkScheduleRepositoryFake(doBanco),
      );

      const resultado = await service.findByDoctorId(2);

      expect(resultado).toEqual({
        // o resultado tem só weekDay, startTime, endTime e slotDurationMinutes, com 08:00 (e não 08:00:00)
        shifts: [
          {
            weekDay: 2,
            startTime: '08:00',
            endTime: '12:00',
            slotDurationMinutes: 30,
          },
          {
            weekDay: 2,
            startTime: '14:00',
            endTime: '18:00',
            slotDurationMinutes: 20,
          },
          {
            weekDay: 4,
            startTime: '08:00',
            endTime: '11:00',
            slotDurationMinutes: 30,
          },
        ],
      });
    });

    // 2º TESTE: Médico que existe mas ainda não tem escala: 200 com a lista vazia, e não 404
    it('devolve { shifts: [] } quando o médico existe e não tem escala', async () => {
      const service = new WorkScheduleService(
        new DoctorRepositoryFake([helena]),
        new WorkScheduleRepositoryFake([]),
      );

      const resultado = await service.findByDoctorId(2);

      expect(resultado).toEqual({ shifts: [] }); // médico 2 existe mas o fake não tem turnos: resultado { shifts: [] } e nenhum erro
    });

    // 3º TESTE: Médico que não existe: 404, e a escala nem é consultada
    it('lança RECURSO_NAO_ENCONTRADO quando o médico não existe e não consulta a escala', async () => {
      const repository = new WorkScheduleRepositoryFake(doBanco);
      const service = new WorkScheduleService(
        new DoctorRepositoryFake([helena]),
        repository,
      );

      const erro = await service.findByDoctorId(999).catch((err) => err);

      expect(erro).toBeInstanceOf(AppException);
      expect(erro.errorCode).toBe('RECURSO_NAO_ENCONTRADO'); // médico 999 não existe: lança AppException com RECURSO_NAO_ENCONTRADO,
      expect(repository.lookups).toBe(0); // e lookups continua em 0 (a escala nem foi consultada)
    });
  });
});
