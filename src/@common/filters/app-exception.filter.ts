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


@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof AppException) {
      const status = ERROR_STATUS[exception.errorCode];
      response.status(status).json({
        statusCode: status,
        error: exception.errorCode,
        message: exception.message,
      });
      return;
    }


    if (exception instanceof HttpException) {
      this.logger.error(exception);
      const status = exception.getStatus();
      response.status(status).json({
        statusCode: status,
        error: STATUS_ERROR_CODE[status] ?? 'DADOS_INVALIDOS',
        message: exception.message,
      });
      return;
    }

    this.logger.error(exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'ERRO_INTERNO',
      message: 'Erro interno do servidor.',
    });
  }
}
