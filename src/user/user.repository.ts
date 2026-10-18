import { Injectable } from '@nestjs/common';
import { User } from './user.entity';

@Injectable()
export abstract class UserRepository {
  abstract findByEmailWithPassword(email: string): Promise<User | null>;
}
