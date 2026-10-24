import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload, sign, SignOptions, verify } from 'jsonwebtoken';
import { AppException } from '../@common/exceptions/app.exception';
import { APIEnv } from '../env';
import { Role } from '../user/user.entity';

export interface AuthUser {
  id: number;
  roles: Role[];
}

@Injectable()
export class JwtService {
  constructor(private readonly configService: ConfigService<APIEnv>) {}

  sign(user: AuthUser): string {
    const secret = this.configService.getOrThrow<string>('JWT_SECRET');
    const expiresIn = this.configService.getOrThrow<string>('JWT_EXPIRES_IN');

    return sign({ roles: user.roles }, secret, {
      subject: String(user.id),
      expiresIn: expiresIn as SignOptions['expiresIn'],
    });
  }

  verify(token: string): AuthUser {
    const secret = this.configService.getOrThrow<string>('JWT_SECRET');

    try {
      const payload = verify(token, secret) as JwtPayload & { roles: Role[] };

      return { id: Number(payload.sub), roles: payload.roles };
    } catch {
      throw new AppException('NAO_AUTENTICADO', 'Token inválido ou expirado.');
    }
  }
}
