import { Injectable } from '@nestjs/common';
import { User } from './user.entity';

export type NewUser = Pick<User, 'name' | 'email' | 'password' | 'roles'>;

@Injectable()
export abstract class UserRepository {
  abstract findByEmailWithPassword(email: string): Promise<User | null>;
  abstract findById(id: number): Promise<User | null>;
  abstract existsByEmail(email: string): Promise<boolean>; // esse e-mail já existe?
  abstract create(data: NewUser): Promise<User>; // Grava o usuário novo e devolve o User completo, já com id.
}
