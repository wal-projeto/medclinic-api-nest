import { describe, it, expect } from 'vitest';
import { AppException } from '../@common/exceptions/app.exception';
import { CreatePatientDto } from './dtos/create-patient.dto';
import { Patient } from './patient.entity';
import { ListPatientsQueryDto } from './dtos/list-patients-query.dto';
import {
  NewPatient,
  PatientFilter,
  PatientPage,
  PatientRepository,
} from './patient.repository';
import { PatientService } from './patient.service';

// CLASSE REPOSITORY FAKE: lista em memória, sem banco real nem rede.
class PatientRepositoryFake implements PatientRepository {
  // O fake anota o último pedido recebido, para o teste conferir a conta do service : { name: 'mar', skip: 20, take: 10 }
  lastFilter?: PatientFilter;
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

  // Faz em memória o que o banco faz: filtra sem diferenciar maiúsculas (toLowerCase), fatia com slice e conta o total
  // 3 pacientes, skip 2, take 2 → [Ana], total 3
  findPage(filter: PatientFilter): Promise<PatientPage> {
    this.lastFilter = filter;
    const found = this.patients.filter(
      (patient) =>
        !filter.name ||
        patient.name.toLowerCase().includes(filter.name.toLowerCase()),
    );
    return Promise.resolve({
      patients: found.slice(filter.skip, filter.skip + filter.take),
      total: found.length,
    });
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

  // Uma "fábrica" de pacientes com a mesma data, para o toEqual poder comparar
  describe('list', () => {
    const data = new Date('2026-10-20T14:03:11.000Z');
    const novoPaciente = (id: number, name: string, cpf: string): Patient => ({
      id,
      name,
      cpf,
      createdAt: data,
      updatedAt: data,
      deletedAt: null,
    });
    let repository: PatientRepositoryFake;
    let service: PatientService;

    beforeEach(() => {
      repository = new PatientRepositoryFake([
        novoPaciente(1, 'Carlos Pereira', '12345678901'),
        novoPaciente(2, 'Maria Souza', '98765432100'),
        novoPaciente(3, 'Ana Lima', '55566677788'),
      ]);
      service = new PatientService(repository);
    });

    //	Página 2 de tamanho 2 com 3 pacientes: só a Ana, e o meta certo : totalPages = Math.ceil(3 / 2) = 2
    it('devolve a página pedida com data e meta', async () => {
      const query = { page: 2, pageSize: 2 } satisfies ListPatientsQueryDto;

      const resultado = await service.list(query);

      expect(resultado).toEqual({
        data: [
          { id: 3, name: 'Ana Lima', cpf: '55566677788', createdAt: data },
        ],
        meta: { total: 3, page: 2, pageSize: 2, totalPages: 2 },
      });
    });

    //Confere a regra da conta: página 3 de 10 pula 20.	skip: 20
    it('repassa o nome e calcula o deslocamento da página', async () => {
      const query = {
        page: 3,
        pageSize: 10,
        name: 'mar',
      } satisfies ListPatientsQueryDto;

      await service.list(query);

      expect(repository.lastFilter).toEqual({
        name: 'mar',
        skip: 20,
        take: 10,
      });
    });

    //Nada encontrado: data vazio e 0 páginas. 	Math.ceil(0 / 20) = 0
    it('devolve lista vazia e totalPages 0 quando nada é encontrado', async () => {
      const query = {
        page: 1,
        pageSize: 20,
        name: 'zzz',
      } satisfies ListPatientsQueryDto;

      const resultado = await service.list(query);

      expect(resultado).toEqual({
        data: [],
        meta: { total: 0, page: 1, pageSize: 20, totalPages: 0 },
      });
    });
  });
});
