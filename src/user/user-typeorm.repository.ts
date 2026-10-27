import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { NewUser, UserRepository } from './user.repository';

export const TYPEORM_USER_REPOSITORY = 'TYPEORM_USER_REPOSITORY' as const;

@Injectable()
export class UserTypeormRepository implements UserRepository {
  constructor(
    @Inject(TYPEORM_USER_REPOSITORY)
    private readonly repository: Repository<User>,
  ) {}

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.repository.findOne({
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        roles: true,
        createdAt: true,
        updatedAt: true,
      },
      where: { email },
    });
  }

  findById(id: number): Promise<User | null> {
    return this.repository.findOne({ where: { id } });
  }

  existsByEmail(email: string): Promise<boolean> {
    return this.repository.existsBy({ email });
  }

  create(data: NewUser): Promise<User> {
    return this.repository.save(this.repository.create(data));
  }
}
