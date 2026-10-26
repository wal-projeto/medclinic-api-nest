// Importa a fábrica de decorators de parâmetro e o tipo ExecutionContext (o "contexto da execução").
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

//Importa só o tipo AuthRequest (requisição com o campo user), que o jwt.guard.ts já exporta.
import type { AuthRequest } from '../jwt.guard';

export const GetAuthUser = createParamDecorator(
  //	_data é o argumento que o decorator poderia receber, como em @GetAuthUser('id'). Não usamos, e o _ avisa isso. context é a requisição em andamento.
  (_data: unknown, context: ExecutionContext) => {
    return context.switchToHttp().getRequest<AuthRequest>().user;
    //switchToHttp().getRequest<AuthRequest>() pega a requisição HTTP. .user é o { id, roles } que o guard gravou. Esse valor vira o parâmetro do método.
  },
);
