import { describe, it, expect } from 'vitest';
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  describe('hash', () => {
    it('gera um hash argon2 diferente da senha original', async () => {
      const hash = await service.hash('senha-correta');

      expect(hash).not.toBe('senha-correta');
      expect(hash.startsWith('$argon2')).toBe(true);
    });
  });

  describe('compare', () => {
    it('devolve true quando a senha confere com o hash', async () => {
      const hash = await service.hash('senha-correta');

      const resultado = await service.compare('senha-correta', hash);

      expect(resultado).toBe(true);
    });

    it('devolve false quando a senha não confere com o hash', async () => {
      const hash = await service.hash('senha-correta');

      const resultado = await service.compare('senha-errada', hash);

      expect(resultado).toBe(false);
    });

    it('devolve false, sem lançar erro, quando o hash é inválido', async () => {
      const resultado = await service.compare(
        'qualquer-senha',
        'hash-invalido',
      );

      expect(resultado).toBe(false);
    });
  });
});
