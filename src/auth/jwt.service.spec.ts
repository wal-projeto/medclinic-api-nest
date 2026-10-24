import { ConfigService } from '@nestjs/config';
import { describe, it, expect } from 'vitest';
import { AppException } from '../@common/exceptions/app.exception';
import { APIEnv } from '../env';
import { JwtService } from './jwt.service';

//Monta o JwtService com uma configuração falsa( sem .env, sem rede). Com o -10 o token nasce já vencido
function criarServico(expiresIn: string | number = '1h'): JwtService {
  const valores: Record<string, string | number> = {
    JWT_SECRET: 'segredo-de-teste',
    JWT_EXPIRES_IN: expiresIn,
  };
  const config = {
    getOrThrow: (chave: string) => valores[chave],
  } as unknown as ConfigService<APIEnv>;

  return new JwtService(config);
}

// Roda um função e devolve o erro que ela lonçou
function capturarErro(funcao: () => unknown): unknown {
  try {
    funcao();
  } catch (erro) {
    return erro;
  }
  return undefined;
}

// 5 testes: token com 3 partes; ida e volta (sign → verify) com id: 7 e dois perfis; token adulterado; token expirado; texto qualquer ('abc')
describe('JwtService', () => {
  const service = criarServico();

  it('gera um token com três partes separadas por ponto', () => {
    const token = service.sign({ id: 7, roles: ['admin'] });

    expect(token.split('.')).toHaveLength(3);
  });

  it('devolve o id e os perfis do usuário ao verificar o token', () => {
    const token = service.sign({ id: 7, roles: ['admin', 'secretary'] });

    expect(service.verify(token)).toEqual({
      id: 7,
      roles: ['admin', 'secretary'],
    });
  });

  it('recusa um token adulterado com NAO_AUTENTICADO', () => {
    const token = service.sign({ id: 7, roles: ['admin'] });
    const adulterado = token.slice(0, -2) + 'xx';

    const erro = capturarErro(() => service.verify(adulterado));

    expect(erro).toBeInstanceOf(AppException);
    expect((erro as AppException).errorCode).toBe('NAO_AUTENTICADO');
  });

  it('recusa um token expirado com NAO_AUTENTICADO', () => {
    const expirado = criarServico(-10).sign({ id: 7, roles: ['admin'] });

    const erro = capturarErro(() => service.verify(expirado));

    expect(erro).toBeInstanceOf(AppException);
    expect((erro as AppException).errorCode).toBe('NAO_AUTENTICADO');
  });

  it('recusa um texto que não é um token com NAO_AUTENTICADO', () => {
    const erro = capturarErro(() => service.verify('abc'));

    expect(erro).toBeInstanceOf(AppException);
    expect((erro as AppException).errorCode).toBe('NAO_AUTENTICADO');
  });
});
