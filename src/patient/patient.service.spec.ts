import { describe, it, expect } from 'vitest';
import { AppException } from '../@common/exceptions/app.exception';
import { CreatePatientDto } from './dtos/create-patient.dto';
import { Patient } from './patient.entity';
import { NewPatient, PatientRepository } from './patient.repository';
import { PatientService } from './patient.service';

// CLASSE REPOSITORY FAKE: lista em memória, sem banco real nem rede.
class PatientRepositoryFake implements PatientRepository {
  constructor(readonly patients: Patient[]) {}

  // "Existe?" = algum item da lista tem esse CPF. Ex: [] → false
  existsByCpf(cpf: string): Promise<boolean> {
    return Promise.resolve(
      this.patients.some((patient) => patient.cpf === cpf),
    );
  }

  //"Grava" = monta o paciente com id sequencial e data fixa (para o toEqual poder comparar) e põe na lista
  create(data: NewPatient): Promise<Patient> {
    // Ex: id 1, createdAt = 2026-10-20T14:03:11.000Z
    const patient: Patient = {
      ...data,
      id: this.patients.length + 1,
      createdAt: new Date('2026-10-20T14:03:11.000Z'),
      updatedAt: new Date('2026-10-20T14:03:11.000Z'),
      deletedAt: null,
    };
    this.patients.push(patient);
    return Promise.resolve(patient);
  }
}

describe('PatientService', () => {
  describe('create', () => {
    const input = {
      name: 'Carlos Pereira',
      cpf: '12345678901',
    } satisfies CreatePatientDto; // O satisfies confere o formato sem alargar os tipos
    let patients: Patient[];
    let service: PatientService;

    // Antes de cada teste, uma lista vazia nova e um service novo: um teste não suja o outro
    beforeEach(() => {
      patients = [];
      service = new PatientService(new PatientRepositoryFake(patients));
    });

    // CAMINHO FELIZ: devolve exatamente os 4 compos, e a lista ficou com 1 : { id:1, name:"Carlos Pereira", cpf:"12345678901", createdAt: Date }
    it('cria o paciente e devolve id, nome, cpf e data de criação', async () => {
      const resultado = await service.create(input);

      expect(resultado).toEqual({
        id: 1,
        name: 'Carlos Pereira',
        cpf: '12345678901',
        createdAt: new Date('2026-10-20T14:03:11.000Z'),
      });
      expect(patients).toHaveLength(1);
    });

    // Cadastra o Carlos, tenta de novo com o mesmo CPF: o erro é o certo e a lista continua com 1, então o segundo não foi gravado
    // erro.errorCode = 'CPF_JA_CADASTRADO'
    it('lança CPF_JA_CADASTRADO quando o CPF já existe e não grava outro', async () => {
      await service.create(input);

      const erro = await service
        .create({ name: 'Outra Pessoa', cpf: '12345678901' })
        .catch((err) => err);

      expect(erro).toBeInstanceOf(AppException);
      expect(erro.errorCode).toBe('CPF_JA_CADASTRADO');
      expect(patients).toHaveLength(1);
    });
  });
});
