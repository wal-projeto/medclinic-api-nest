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
    // <-- só o findById é usado pelo service; os outros métodos existem porque o implements obriga
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

// FAKE DA ESCALA: anota o que o service mandou gravar e devolve os turnos com id (e a hora com segundos, como o banco devolve ao ler)
class WorkScheduleRepositoryFake implements WorkScheduleRepository {
  lastDoctorId?: number;
  lastShifts?: NewWorkShift[];

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
}

describe('WorkScheduleService', () => {
  describe('replace', () => {
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
});
