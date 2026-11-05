import { describe, it, expect, beforeEach } from 'vitest';
import { AppException } from '../@common/exceptions/app.exception';
import {
  Appointment,
  AppointmentStatus,
} from '../appointment/appointment.entity';
import {
  AppointmentRepository,
  AssertFree,
  NewAppointment,
} from '../appointment/appointment.repository';
import { Doctor } from '../doctor/doctor.entity';
import { DoctorPage, DoctorRepository } from '../doctor/doctor.repository';
import { Patient } from '../patient/patient.entity';
import { PatientPage, PatientRepository } from '../patient/patient.repository';
import { MedicalRecord } from './medical-record.entity';
import {
  MedicalRecordRepository,
  NewMedicalRecord,
} from './medical-record.repository';
import { MedicalRecordService } from './medical-record.service';

// FAKE DO MÉDICO: o service só usa o findByUserId (o médico do usuário do token); os outros métodos existem porque o implements obriga
class DoctorRepositoryFake implements DoctorRepository {
  lookups = 0; // quantas vezes o service procurou o médico do usuário

  constructor(readonly doctors: Doctor[]) {}

  findById(id: number): Promise<Doctor | null> {
    return Promise.resolve(this.doctors.find((d) => d.id === id) ?? null);
  }

  // o médico do usuário de acesso (o doctor() abaixo põe o usuário 100 + id no médico)
  findByUserId(userId: number): Promise<Doctor | null> {
    this.lookups++;
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

// FAKE DAS CONSULTAS: o service só usa o existsByDoctorAndPatient. Faz o que o banco faria: há consulta deste médico com este
// paciente em um dos estados pedidos? Anota cada pergunta (checks)
class AppointmentRepositoryFake implements AppointmentRepository {
  checks: {
    doctorId: number;
    patientId: number;
    statuses: AppointmentStatus[];
  }[] = [];

  constructor(readonly stored: Appointment[] = []) {}

  existsByDoctorAndPatient(
    doctorId: number,
    patientId: number,
    statuses: AppointmentStatus[],
  ): Promise<boolean> {
    this.checks.push({ doctorId, patientId, statuses });
    return Promise.resolve(
      this.stored.some(
        (a) =>
          a.doctorId === doctorId &&
          a.patientId === patientId &&
          statuses.includes(a.status),
      ),
    );
  }

  createWithLock(_data: NewAppointment, _assertFree: AssertFree) {
    return Promise.reject<Appointment>(new Error('não usado'));
  }

  findActiveByDoctorInPeriod(): Promise<Appointment[]> {
    return Promise.reject(new Error('não usado'));
  }

  findPage(): Promise<never> {
    return Promise.reject(new Error('não usado'));
  }

  findById(): Promise<Appointment | null> {
    return Promise.reject(new Error('não usado'));
  }

  updateStatus(): Promise<boolean> {
    return Promise.reject(new Error('não usado'));
  }
}

// FAKE DO PRONTUÁRIO: anota o que o service mandou gravar (created) e devolve o registro como o banco devolveria, com id e createdAt
class MedicalRecordRepositoryFake implements MedicalRecordRepository {
  created?: NewMedicalRecord;

  create(data: NewMedicalRecord): Promise<MedicalRecord> {
    this.created = data;
    return Promise.resolve({
      ...data,
      id: 5,
      patient: undefined as unknown as Patient,
      doctor: undefined as unknown as Doctor,
      createdAt: new Date('2026-10-13T11:25:00.000Z'),
    });
  }
}

describe('MedicalRecordService', () => {
  const agora = new Date('2026-11-06T12:00:00.000Z');
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
  // Uma consulta que já está marcada, entre o médico e o paciente, no estado pedido
  const consulta = (
    doctorId: number,
    patientId: number,
    status: AppointmentStatus,
  ): Appointment => ({
    id: 1,
    doctorId,
    patientId,
    startsAt: new Date('2026-10-13T11:00:00.000Z'),
    endsAt: new Date('2026-10-13T11:30:00.000Z'),
    status,
    doctor: undefined as unknown as Doctor,
    patient: undefined as unknown as Patient,
    createdAt: agora,
    updatedAt: agora,
  });

  const texto =
    'Paciente relata dor lombar há duas semanas. Solicitado raio-X.';
  const helena = { id: 102, roles: ['doctor' as const] }; // o usuário da Dra. Helena (médico 2)
  const paulo = { id: 103, roles: ['doctor' as const] }; // o usuário do Dr. Paulo (médico 3)

  let doctors: DoctorRepositoryFake;
  let appointments: AppointmentRepositoryFake;
  let records: MedicalRecordRepositoryFake;
  let service: MedicalRecordService;

  // Os médicos 2 (Helena) e 3 (Paulo) e os pacientes 10 e 11 existem; stored são as consultas que já estão marcadas
  const montar = (stored: Appointment[] = []) => {
    doctors = new DoctorRepositoryFake([doctor(2), doctor(3)]);
    appointments = new AppointmentRepositoryFake(stored);
    records = new MedicalRecordRepositoryFake();
    service = new MedicalRecordService(
      new PatientRepositoryFake([patient(10), patient(11)]),
      doctors,
      appointments,
      records,
    );
  };

  beforeEach(() => montar());

  // O caminho feliz: a Helena tem uma consulta em andamento com o paciente 10; o autor é o médico 2 (o do token)
  it('grava o registro e devolve os cinco campos do contrato', async () => {
    montar([consulta(2, 10, 'in_progress')]);

    const resultado = await service.create(10, { text: texto }, helena);

    expect(resultado).toEqual({
      id: 5,
      patientId: 10,
      doctorId: 2,
      text: texto,
      createdAt: new Date('2026-10-13T11:25:00.000Z'),
    });
    expect(records.created).toEqual({
      patientId: 10,
      doctorId: 2,
      text: texto,
    });
    // a regra do vínculo é do service: ele pede ao banco só os estados em andamento e concluída
    expect(appointments.checks).toEqual([
      { doctorId: 2, patientId: 10, statuses: ['in_progress', 'done'] },
    ]);
  });

  it('conta a consulta concluída como vínculo', async () => {
    montar([consulta(2, 10, 'done')]);

    const resultado = await service.create(10, { text: texto }, helena);

    expect(resultado.doctorId).toBe(2);
  });

  // O autor vem do token: com dois médicos que atenderam o mesmo paciente, quem escreve é o do usuário que fez o pedido
  it('grava como autor o médico do token', async () => {
    montar([consulta(2, 10, 'done'), consulta(3, 10, 'in_progress')]);

    const resultado = await service.create(10, { text: texto }, paulo);

    expect(resultado.doctorId).toBe(3);
    expect(records.created?.doctorId).toBe(3);
  });

  // Sem vínculo: só consulta agendada (ainda não começou) ou cancelada (não houve atendimento) não conta
  it('lança ACESSO_NEGADO quando o médico só tem consulta agendada ou cancelada com o paciente', async () => {
    for (const status of ['scheduled', 'cancelled'] as const) {
      montar([consulta(2, 10, status)]);

      const erro = await service
        .create(10, { text: texto }, helena)
        .catch((err) => err);

      expect(erro).toBeInstanceOf(AppException);
      expect(erro.errorCode).toBe('ACESSO_NEGADO');
      expect(erro.message).toBe(
        'Só o médico que atendeu o paciente pode escrever no prontuário',
      );
      expect(records.created).toBeUndefined(); // nada foi gravado
    }
  });

  it('lança ACESSO_NEGADO quando o vínculo é com outro paciente', async () => {
    montar([consulta(2, 11, 'done')]); // a Helena atendeu o paciente 11, e não o 10

    const erro = await service
      .create(10, { text: texto }, helena)
      .catch((err) => err);

    expect(erro.errorCode).toBe('ACESSO_NEGADO');
    expect(records.created).toBeUndefined();
  });

  it('lança ACESSO_NEGADO quando o paciente foi atendido por outro médico', async () => {
    montar([consulta(3, 10, 'done')]); // quem atendeu o paciente 10 foi o Dr. Paulo

    const erro = await service
      .create(10, { text: texto }, helena)
      .catch((err) => err);

    expect(erro.errorCode).toBe('ACESSO_NEGADO');
    expect(records.created).toBeUndefined();
  });

  // O usuário doctor sem registro de médico (criado pelo POST /users, e não pelo POST /doctors) não tem vínculo com ninguém
  it('lança ACESSO_NEGADO quando o usuário doctor não tem registro de médico, sem nem conferir o vínculo', async () => {
    montar([consulta(2, 10, 'done')]);

    const erro = await service
      .create(10, { text: texto }, { id: 555, roles: ['doctor'] })
      .catch((err) => err);

    expect(erro.errorCode).toBe('ACESSO_NEGADO');
    expect(appointments.checks).toHaveLength(0);
    expect(records.created).toBeUndefined();
  });

  // O 404 vem antes de tudo: o paciente não existe, e o service nem procura o médico
  it('lança RECURSO_NAO_ENCONTRADO quando o paciente não existe', async () => {
    montar([consulta(2, 10, 'done')]);

    const erro = await service
      .create(99, { text: texto }, helena)
      .catch((err) => err);

    expect(erro).toBeInstanceOf(AppException);
    expect(erro.errorCode).toBe('RECURSO_NAO_ENCONTRADO');
    expect(erro.message).toBe('Paciente não encontrado');
    expect(doctors.lookups).toBe(0);
    expect(records.created).toBeUndefined();
  });
});
