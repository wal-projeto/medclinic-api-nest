import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserModule } from '../user/user.module';
import { Doctor } from './doctor.entity';
import { DoctorRepository } from './doctor.repository';
import {
  DoctorTypeormRepository,
  TYPEORM_DOCTOR_REPOSITORY,
} from './doctor-typeorm.repository';
import { DoctorController } from './doctor.controller';
import { DoctorService } from './doctor.service';

@Module({
  imports: [UserModule], // traz o UserRepository (o UserModule o exporta), que o DoctorService usa para conferir o e-mail
  controllers: [DoctorController],
  providers: [
    // quando alguém pedir um DoctorRepository, entregue um DoctorTypeormRepository
    { provide: DoctorRepository, useClass: DoctorTypeormRepository },
    {
      // fabrica o Repository<Doctor> do TypeORM a partir do DataSource (a conexão global) e guarda com a etiqueta
      provide: TYPEORM_DOCTOR_REPOSITORY,
      useFactory(dataSource: DataSource) {
        return dataSource.getRepository(Doctor);
      },
      inject: [DataSource],
    },
    DoctorService,
  ],
})
export class DoctorModule {}
