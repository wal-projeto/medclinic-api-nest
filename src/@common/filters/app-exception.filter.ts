import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

import { AppException, ErrorCode } from '../exceptions/app.exception';

// tipo utilitário" do TypeScript que significa "um objeto onde toda chave é um ErrorCode e todo valor é number
const ERROR_STATUS: Record<ErrorCode, number> = {
  DADOS_INVALIDOS: 400,
  NAO_AUTENTICADO: 401,
  CREDENCIAIS_INVALIDAS: 401,
  ACESSO_NEGADO: 403,
  RECURSO_NAO_ENCONTRADO: 404,
  EMAIL_JA_CADASTRADO: 409,
  CPF_JA_CADASTRADO: 409,
  CRM_JA_CADASTRADO: 409,
  HORARIO_INDISPONIVEL: 409,
  PACIENTE_INDISPONIVEL: 409,
  HORARIO_FORA_DA_ESCALA: 422,
  TRANSICAO_INVALIDA: 422,
};

const STATUS_ERROR_CODE: Partial<Record<number, ErrorCode>> = {
  400: 'DADOS_INVALIDOS',
  401: 'NAO_AUTENTICADO',
  403: 'ACESSO_NEGADO',
  404: 'RECURSO_NAO_ENCONTRADO',
};

// Junta as mensagens de validação (uma por campo) em um texto só, separado por "; ".
function extractMessage(exception: HttpException): string {
  const body = exception.getResponse();

  if (typeof body === 'object' && body !== null && 'message' in body) {
    const detail = body.message;
    if (Array.isArray(detail)) return detail.join('; ');
    if (typeof detail === 'string') return detail;
  }

  return exception.message;
}

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    // Erro de regra de negócio lançado pelo nosso código.
    if (exception instanceof AppException) {
      const status = ERROR_STATUS[exception.errorCode];
      response.status(status).json({
        statusCode: status,
        error: exception.errorCode,
        message: exception.message,
      });
      return;
    }

    // Erro HTTP lançado pelo Nest (validação, rota inexistente etc.).
    if (exception instanceof HttpException) {
      this.logger.error(exception);
      const status = exception.getStatus();
      response.status(status).json({
        statusCode: status,
        error: STATUS_ERROR_CODE[status] ?? 'DADOS_INVALIDOS',
        message: extractMessage(exception),
      });
      return;
    }

    // Erro inesperado: o detalhe fica só no log, nunca na resposta.
    // A lista de códigos de erro da API não tem um codigo para falhas do servidor,
    // por isso este caso responde com ERRO_INTERNO.
    this.logger.error(exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'ERRO_INTERNO',
      message: 'Erro interno do servidor.',
    });
  }
}
