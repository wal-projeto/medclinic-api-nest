import { describe, it, expect } from 'vitest';
import { UserRepository } from './user.repository';
import { User } from './user.entity';
import { PasswordService } from '../auth/password.service';
import { UserService } from './user.service';
import { AppException } from '../@common/exceptions/app.exception';

class UserRepositoryFake implements UserRepository {
  constructor(private readonly users: User[]) {}

  findByEmailWithPassword(email: string): Promise<User | null> {
    const user = this.users.find((user) => user.email === email) ?? null;
    return Promise.resolve(user);
  }

  findById(id: number): Promise<User | null> {
    const user = this.users.find((user) => user.id === id) ?? null;
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
});
