import { SetMetadata } from '@nestjs/common';
import { Role } from '../../user/user.entity';

export const REQUIRED_ROLES_KEY = 'REQUIRED_ROLES';

// Grava na rota a lista de perfis aceitos, por exemplo @RequireRole(['admin', 'secretary','doctor'])
export const RequireRole = (roles: Role[]) =>
  SetMetadata(REQUIRED_ROLES_KEY, roles);
