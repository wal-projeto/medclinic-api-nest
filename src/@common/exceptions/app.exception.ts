import { HttpException } from '@nestjs/common';

const ERROR_STATUS = {
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
} as const;
export class AppException extends HttpException {
  constructor(errorCode: keyof typeof ERROR_STATUS, message: string) {
    const statusCode = ERROR_STATUS[errorCode];
    super({ statusCode, error: errorCode, message }, statusCode);
  }
}
