import { describe, it, expect } from 'vitest';
import { AppException } from '../@common/exceptions/app.exception';
import { PasswordService } from '../auth/password.service';
import { User } from '../user/user.entity';
import { NewUser, UserRepository } from '../user/user.repository';
import { CreateDoctorDto } from './dtos/create-doctor.dto';
import { Doctor } from './doctor.entity';
import { DoctorRepository, NewDoctor } from './doctor.repository';
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

  constructor(readonly doctors: Doctor[]) {}

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
});
