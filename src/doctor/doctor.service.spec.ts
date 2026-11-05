import { describe, it, expect } from 'vitest';
import { AppException } from '../@common/exceptions/app.exception';
import { PasswordService } from '../auth/password.service';
import { User } from '../user/user.entity';
import { NewUser, UserRepository } from '../user/user.repository';
import { CreateDoctorDto } from './dtos/create-doctor.dto';
import { ListDoctorsQueryDto } from './dtos/list-doctors-query.dto';
import { Doctor } from './doctor.entity';
import {
  DoctorFilter,
  DoctorPage,
  DoctorRepository,
  NewDoctor,
} from './doctor.repository';
import { DoctorService } from './doctor.service';

// O Fake do UserRepository (a porta tem quatro métodos, e o implements obriga a escrever todos que existem na Interface).
// o DoctorService só usa o existsByEmail
class UserRepositoryFake implements UserRepository {
  constructor(readonly users: User[]) {}

  findByEmailWithPassword(email: string): Promise<User | null> {
    return Promise.resolve(this.users.find((u) => u.email === email) ?? null);
  }

  findById(id: number): Promise<User | null> {
    return Promise.resolve(this.users.find((u) => u.id === id) ?? null);
  }

  existsByEmail(email: string): Promise<boolean> {
    //    <<<----- unico método usado pelo service.
    return Promise.resolve(this.users.some((u) => u.email === email));
  }

  create(data: NewUser): Promise<User> {
    const user: User = {
      ...data,
      id: this.users.length + 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.push(user);
    return Promise.resolve(user);
  }
}

// FAKE DO MÉDICO: lista em memória, sem banco real nem rede.
class DoctorRepositoryFake implements DoctorRepository {
  // O fake anota o último pedido de gravação, para o teste conferir o que o service mandou gravar
  lastCreated?: NewDoctor;
  // e o último pedido de página, para o teste conferir o que o service mandou buscar
  lastFilter?: DoctorFilter;

  constructor(readonly doctors: Doctor[]) {}

  // O DoctorService não usa a busca pelo usuário: existe só porque o implements obriga
  findByUserId(): Promise<Doctor | null> {
    return Promise.resolve(null);
  }

  // "Existe?" = algum médico da lista tem esse CRM
  existsByCrm(crm: string): Promise<boolean> {
    return Promise.resolve(this.doctors.some((d) => d.crm === crm));
  }

  // "Grava" = anota o pedido e devolve o médico completo, com o usuário dentro (como o banco devolveria)
  createWithUser(data: NewDoctor): Promise<Doctor> {
    this.lastCreated = data;
    const agora = new Date('2026-11-01T22:00:00.000Z');
    const user: User = {
      ...data.user,
      id: 7,
      createdAt: agora,
      updatedAt: agora,
    };
    const doctor: Doctor = {
      id: 3,
      crm: data.crm,
      user,
      createdAt: agora,
      updatedAt: agora,
    };
    this.doctors.push(doctor);
    return Promise.resolve(doctor);
  }

  // Faz em memória o que o banco faz: filtra pelo nome do usuário sem diferenciar maiúsculas (toLowerCase), fatia com slice e conta o total
  // 3 médicos, skip 2, take 2 → [o terceiro], total 3
  findPage(filter: DoctorFilter): Promise<DoctorPage> {
    this.lastFilter = filter;
    const found = this.doctors.filter(
      (doctor) =>
        !filter.name ||
        doctor.user.name.toLowerCase().includes(filter.name.toLowerCase()),
    );
    return Promise.resolve({
      doctors: found.slice(filter.skip, filter.skip + filter.take),
      total: found.length,
    });
  }

  // "Busca pelo número" = o médico da lista com esse id, ou null (o mesmo que o banco devolve quando não acha)
  findById(id: number): Promise<Doctor | null> {
    return Promise.resolve(this.doctors.find((d) => d.id === id) ?? null);
  }
}

describe('DoctorService', () => {
  // TESTANDO O CADASTRO
  describe('create', () => {
    const passwordService = new PasswordService();
    const agora = new Date('2026-11-01T21:00:00.000Z');
    const input = {
      name: 'Dra. Helena Souza',
      email: 'helena.souza@clinica.com',
      password: 'SenhaForte@123',
      crm: 'CRM-SC-54321',
    } satisfies CreateDoctorDto;
    let users: UserRepositoryFake;
    let doctors: DoctorRepositoryFake;
    let service: DoctorService;

    beforeEach(() => {
      // já existem: a Ana (e-mail ana@clinica.com) e um médico com o CRM CRM-SC-11111
      users = new UserRepositoryFake([
        {
          id: 1,
          name: 'Ana',
          email: 'ana@clinica.com',
          password: 'hash-qualquer',
          roles: ['secretary'],
          createdAt: agora,
          updatedAt: agora,
        },
      ]);
      doctors = new DoctorRepositoryFake([
        {
          id: 1,
          crm: 'CRM-SC-11111',
          user: users.users[0],
          createdAt: agora,
          updatedAt: agora,
        },
      ]);
      service = new DoctorService(doctors, users, passwordService);
    });

    // Caminho que dá certo: perfil doctor, senha guardada como hash e resposta no formato do contrato (sem a senha)
    it('cadastra o médico com perfil doctor, guarda o hash da senha e devolve o formato do contrato', async () => {
      const resultado = await service.create(input);

      expect(resultado).toEqual({
        id: 3,
        crm: 'CRM-SC-54321',
        user: {
          id: 7,
          name: 'Dra. Helena Souza',
          email: 'helena.souza@clinica.com',
          roles: ['doctor'],
        },
      });
      const gravado = doctors.lastCreated;
      expect(gravado?.user.roles).toEqual(['doctor']);
      expect(gravado?.user.password).not.toBe('SenhaForte@123');
      expect(
        await passwordService.compare(
          'SenhaForte@123',
          gravado?.user.password ?? '',
        ),
      ).toBe(true);
    });

    // E-mail que já existe: a exceção certa, e nada é gravado
    it('lança EMAIL_JA_CADASTRADO quando o e-mail já existe e não grava nada', async () => {
      const erro = await service
        .create({ ...input, email: 'ana@clinica.com' })
        .catch((err) => err);

      expect(erro).toBeInstanceOf(AppException);
      expect(erro.errorCode).toBe('EMAIL_JA_CADASTRADO');
      expect(doctors.lastCreated).toBeUndefined();
    });

    // CRM que já existe (com e-mail novo): a exceção certa, e nada é gravado: nem o médico, nem o usuário
    it('lança CRM_JA_CADASTRADO quando o CRM já existe e não grava nada', async () => {
      const erro = await service
        .create({ ...input, crm: 'CRM-SC-11111' })
        .catch((err) => err);

      expect(erro).toBeInstanceOf(AppException);
      expect(erro.errorCode).toBe('CRM_JA_CADASTRADO');
      expect(doctors.lastCreated).toBeUndefined();
      expect(users.users).toHaveLength(1);
    });
  });

  // TESTANDO A LISTAGEM
  describe('list', () => {
    const data = new Date('2026-11-02T14:00:00.000Z');
    // Uma "fábrica" de médicos (com o usuário dentro) e as mesmas datas, para o toEqual poder comparar
    const novoMedico = (
      id: number,
      name: string,
      email: string,
      crm: string,
    ): Doctor => ({
      id,
      crm,
      user: {
        id: id + 10,
        name,
        email,
        password: 'hash-qualquer',
        roles: ['doctor'],
        createdAt: data,
        updatedAt: data,
      },
      createdAt: data,
      updatedAt: data,
    });
    let repository: DoctorRepositoryFake;
    let service: DoctorService;

    beforeEach(() => {
      repository = new DoctorRepositoryFake([
        novoMedico(1, 'Dr. Paulo Lima', 'paulo@clinica.com', 'CRM-SC-10001'),
        novoMedico(
          2,
          'Dra. Helena Souza',
          'helena@clinica.com',
          'CRM-SC-10002',
        ),
        novoMedico(3, 'Dra. Ana Costa', 'ana@clinica.com', 'CRM-SC-10003'),
      ]);
      // a listagem só usa o repositório do médico: o do usuário e o de senha não entram
      service = new DoctorService(
        repository,
        new UserRepositoryFake([]),
        new PasswordService(),
      );
    });

    // Página 2 de tamanho 2 com 3 médicos: só a Dra. Ana, no formato do contrato (sem a senha) e o meta certo : totalPages = Math.ceil(3 / 2) = 2
    it('devolve a página pedida, no formato do contrato, com data e meta', async () => {
      const query = { page: 2, pageSize: 2 } satisfies ListDoctorsQueryDto;

      const resultado = await service.list(query);

      expect(resultado).toEqual({
        data: [
          {
            id: 3,
            crm: 'CRM-SC-10003',
            user: {
              id: 13,
              name: 'Dra. Ana Costa',
              email: 'ana@clinica.com',
              roles: ['doctor'],
            },
          },
        ],
        meta: { total: 3, page: 2, pageSize: 2, totalPages: 2 },
      });
    });

    // Confere a regra da conta: página 3 de 10 pula 20.	skip: 20
    it('repassa o nome e calcula o deslocamento da página', async () => {
      const query = {
        page: 3,
        pageSize: 10,
        name: 'hel',
      } satisfies ListDoctorsQueryDto;

      await service.list(query);

      expect(repository.lastFilter).toEqual({
        name: 'hel',
        skip: 20,
        take: 10,
      });
    });

    // Nada encontrado: data vazio e 0 páginas. 	Math.ceil(0 / 20) = 0
    it('devolve lista vazia e totalPages 0 quando nada é encontrado', async () => {
      const query = {
        page: 1,
        pageSize: 20,
        name: 'zzz',
      } satisfies ListDoctorsQueryDto;

      const resultado = await service.list(query);

      expect(resultado).toEqual({
        data: [],
        meta: { total: 0, page: 1, pageSize: 20, totalPages: 0 },
      });
    });
  });

  // TESTANDO A CONSULTA POR id
  describe('findById', () => {
    const data = new Date('2026-11-02T14:00:00.000Z');
    const helena: Doctor = {
      // um médico completo, com o usuário (e a senha em hash) dentro, como sai do banco
      id: 2,
      crm: 'CRM-SC-10002',
      user: {
        id: 12,
        name: 'Dra. Helena Souza',
        email: 'helena@clinica.com',
        password: 'hash-qualquer',
        roles: ['doctor'],
        createdAt: data,
        updatedAt: data,
      },
      createdAt: data,
      updatedAt: data,
    };
    const service = new DoctorService(
      new DoctorRepositoryFake([helena]),
      new UserRepositoryFake([]),
      new PasswordService(),
    );

    // A resposta tem exatamente o formato do cadastro: sem a senha e sem as datas
    it('devolve o médico no mesmo formato do cadastro', async () => {
      const resultado = await service.findById(2);

      expect(resultado).toEqual({
        id: 2,
        crm: 'CRM-SC-10002',
        user: {
          id: 12,
          name: 'Dra. Helena Souza',
          email: 'helena@clinica.com',
          roles: ['doctor'],
        },
      });
    });

    // O caminho de erro: a exceção certa, com o código certo
    it('lança RECURSO_NAO_ENCONTRADO quando o médico não existe', async () => {
      const erro = await service.findById(999).catch((err) => err);

      expect(erro).toBeInstanceOf(AppException);
      expect(erro.errorCode).toBe('RECURSO_NAO_ENCONTRADO');
    });
  });
});
