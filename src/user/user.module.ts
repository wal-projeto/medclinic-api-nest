import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from './user.entity';
import { UserRepository } from './user.repository';
import {
  TYPEORM_USER_REPOSITORY,
  UserTypeormRepository,
} from './user-typeorm.repository';
import { UserService } from './user.service';

@Module({
  providers: [
    { provide: UserRepository, useClass: UserTypeormRepository },
    {
      provide: TYPEORM_USER_REPOSITORY,
      useFactory(dataSource: DataSource) {
        return dataSource.getRepository(User);
      },
      inject: [DataSource],
    },
    UserService,
  ],
  exports: [UserRepository, UserService],
})
export class UserModule {}
