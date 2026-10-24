import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppException } from '../@common/exceptions/app.exception';
import { Role } from '../user/user.entity';
import { PUBLIC_ROUTE_KEY } from './decorator/public-route.decorator';
import { REQUIRED_ROLES_KEY } from './decorator/require-role.decorator';
import { AuthUser, JwtService } from './jwt.service';

export type AuthRequest = Request & { user?: AuthUser };

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const alvos = [context.getHandler(), context.getClass()];
    const rotaPublica = this.reflector.getAllAndOverride<boolean | undefined>(
      PUBLIC_ROUTE_KEY,
      alvos,
    );

    if (rotaPublica) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const user = this.jwtService.verify(this.extractToken(request));

    const perfisExigidos = this.reflector.getAllAndOverride<Role[] | undefined>(
      REQUIRED_ROLES_KEY,
      alvos,
    );

    if (
      perfisExigidos &&
      !perfisExigidos.some((perfil) => user.roles.includes(perfil))
    ) {
      throw new AppException(
        'ACESSO_NEGADO',
        'Você não tem permissão para esta operação.',
      );
    }

    request.user = user;

    return true;
  }

  private extractToken(request: Request): string {
    const [tipo, token] = (request.headers.authorization ?? '').split(' ');

    if (tipo.toLocaleLowerCase() !== 'bearer' || !token) {
      throw new AppException('NAO_AUTENTICADO', 'Token ausente ou malformado.');
    }

    return token;
  }
}
