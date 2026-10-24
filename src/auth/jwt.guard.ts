import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppException } from '../@common/exceptions/app.exception';
import { PUBLIC_ROUTE_KEY } from './decorator/public-route.decorator';
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

    // Extai o token e confere
    const request = context.switchToHttp().getRequest<AuthRequest>();
    request.user = this.jwtService.verify(this.extractToken(request));
    //anexa o usuário na requesição : request.use = { id: 1, roles: ['admin']}

    return true;
  }

  // Lê o cabeçalho Authorization e separa em duas partes: 'Bearer eyJ...' → tipo='Bearer', token='eyJ...'
  private extractToken(request: Request): string {
    const [tipo, token] = (request.headers.authorization ?? '').split(' ');

    // Sem Bearer ou sem token → 401 NAO_AUTORIZADO
    if (tipo !== 'Bearer' || !token) {
      throw new AppException('NAO_AUTENTICADO', 'Token ausente ou malformado.');
    }

    return token;
  }
}
