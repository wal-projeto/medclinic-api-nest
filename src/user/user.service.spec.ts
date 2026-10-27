import { describe, it, expect } from 'vitest';
import { NewUser, UserRepository } from './user.repository';
import { User } from './user.entity';
import { PasswordService } from '../auth/password.service';
import { UserService } from './user.service';
import { AppException } from '../@common/exceptions/app.exception';
import { CreateUserDto } from './dtos/create-user.dto';

// CLASSE REPOSITORY FAKE: lista em memória, sem banco real nem rede.
class UserRepositoryFake implements UserRepository {
  constructor(readonly users: User[]) {}

  findByEmailWithPassword(email: string): Promise<User | null> {
    const user = this.users.find((user) => user.email === email) ?? null;
    return Promise.resolve(user);
  }

  findById(id: number): Promise<User | null> {
    const user = this.users.find((user) => user.id === id) ?? null;
    return Promise.resolve(user);
  }

  existsByEmail(email: string): Promise<boolean> {
    return Promise.resolve(this.users.some((user) => user.email === email));
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

describe('UserService', () => {
  // LOGIN
  describe('login', () => {
    const passwordService = new PasswordService();
    let service: UserService;

    beforeEach(async () => {
      const usuarioFixo: User = {
        id: 1,
        name: 'Ana',
        email: 'ana2@clinica.com',
        password: await passwordService.hash('senha-correta'),
        roles: ['secretary'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const userRepositoryFake = new UserRepositoryFake([usuarioFixo]);
      service = new UserService(userRepositoryFake, passwordService);
    });

    it('faz login com sucesso quando email e senha estão corretos', async () => {
      const resultado = await service.login({
        email: 'ana2@clinica.com',
        password: 'senha-correta',
      });
      expect(resultado.email).toBe('ana2@clinica.com');
    });

    it('lança CREDENCIAIS_INVALIDAS quando a senha está errada', async () => {
      const erro = await service
        .login({ email: 'ana2@clinica.com', password: 'senha-errada' })
        .catch((err) => err);

      expect(erro).toBeInstanceOf(AppException);
      expect(erro.errorCode).toBe('CREDENCIAIS_INVALIDAS');
    });

    it('lança CREDENCIAIS_INVALIDAS quando o email não existe', async () => {
      const erro = await service
        .login({ email: 'naoexiste@clinica.com', password: 'qualquer-senha' })
        .catch((err) => err);

      expect(erro).toBeInstanceOf(AppException);
      expect(erro.errorCode).toBe('CREDENCIAIS_INVALIDAS');
    });
  });

  // ME
  describe('me', () => {
    const usuario: User = {
      id: 1,
      name: 'Ana',
      email: 'ana2@clinica.com',
      password: 'hash-qualquer',
      roles: ['secretary'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const service = new UserService(
      new UserRepositoryFake([usuario]),
      new PasswordService(),
    );

    it('devolve id, nome, e-mail e perfis do usuário, sem a senha', async () => {
      const resultado = await service.me(1);

      expect(resultado).toEqual({
        id: 1,
        name: 'Ana',
        email: 'ana2@clinica.com',
        roles: ['secretary'],
      });
      expect(resultado).not.toHaveProperty('password');
    });

    it('lança NAO_AUTENTICADO quando o usuário do token não existe mais', async () => {
      const erro = await service.me(999).catch((err) => err);

      expect(erro).toBeInstanceOf(AppException);
      expect(erro.errorCode).toBe('NAO_AUTENTICADO');
    });
  });

  // CREATE
  describe('create', () => {
    const passwordService = new PasswordService();
    const input = {
      name: 'Joana',
      email: 'joana@clinica.com',
      password: 'SenhaForte@123',
      roles: ['secretary'],
    } satisfies CreateUserDto;
    let users: User[];
    let service: UserService;

    beforeEach(() => {
      users = [
        {
          id: 1,
          name: 'Admin',
          email: 'admin@clinica.com',
          password: 'hash-qualquer',
          roles: ['admin'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      service = new UserService(new UserRepositoryFake(users), passwordService);
    });

    it('cria o usuário e devolve só id, nome, e-mail e perfis', async () => {
      const resultado = await service.create(input);

      expect(resultado).toEqual({
        id: 2,
        name: 'Joana',
        email: 'joana@clinica.com',
        roles: ['secretary'],
      });
      expect(resultado).not.toHaveProperty('password');
    }); //O retorno tem exatamente os 4 campos e nada de senha.

    it('guarda a senha como hash, não em texto', async () => {
      await service.create(input);

      const salvo = users[1];
      expect(salvo.password).not.toBe(input.password);
      expect(
        await passwordService.compare(input.password, salvo.password),
      ).toBe(true); // A senha foi guardada como hash e o compare do argon2 confirma que o hash corresponde à senha original.
    });

    it('lança EMAIL_JA_CADASTRADO quando o e-mail já existe', async () => {
      const erro = await service
        .create({ ...input, email: 'admin@clinica.com' })
        .catch((err) => err);

      expect(erro).toBeInstanceOf(AppException);
      expect(erro.errorCode).toBe('EMAIL_JA_CADASTRADO');
      expect(users).toHaveLength(1);
    }); // E-mail repetido lança o erro certo e não grava nada (a lista continua com 1).
  });
});
