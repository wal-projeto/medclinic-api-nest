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
import { WorkScheduleController } from './work-schedule.controller';
import { WorkScheduleRepository } from './work-schedule.repository';
import {
  TYPEORM_WORK_SHIFT_REPOSITORY,
  WorkScheduleTypeormRepository,
} from './work-schedule-typeorm.repository';
import { WorkScheduleService } from './work-schedule.service';
import { WorkShift } from './work-shift.entity';

@Module({
  imports: [UserModule], // traz o UserRepository (o UserModule o exporta), que o DoctorService usa para conferir o e-mail
  controllers: [DoctorController, WorkScheduleController],
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
    // a escala: a porta, o adaptador, o Repository<WorkShift> do TypeORM e o service
    {
      provide: WorkScheduleRepository, //quem pedir a porta WorkScheduleRepository recebe o adaptador do TypeORM
      useClass: WorkScheduleTypeormRepository,
    },
    {
      provide: TYPEORM_WORK_SHIFT_REPOSITORY, // fabrica o Repository<WorkShift> a partir da conexão e guarda com a etiqueta
      useFactory(dataSource: DataSource) {
        return dataSource.getRepository(WorkShift);
      },
      inject: [DataSource],
    },
    WorkScheduleService,
  ],
  exports: [DoctorRepository, WorkScheduleRepository, WorkScheduleService], // outros módulos (as consultas) usam estas duas portas e o service da escala (a agenda)
})
export class DoctorModule {}
