import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Patient } from './patient.entity';
import { PatientRepository } from './patient.repository';
import {
  PatientTypeormRepository,
  TYPEORM_PATIENT_REPOSITORY,
} from './patient-typeorm.repository';
import { PatientController } from './patient.controller';
import { PatientService } from './patient.service';

@Module({
  controllers: [PatientController], // registra o controller: é aqui que a rota passa a existir
  providers: [
    //quando alguem pedir um PatientRepository, entregue um PatientTypeormRepository. A ID ligando a porta à implementação
    { provide: PatientRepository, useClass: PatientTypeormRepository },
    {
      // Fabrica o Repository<Patient> do TypeORM a partir do DataSource (a conexão global do DatabaseModule)
      // e guarda com a etiqueta TYPEORM_PATIENT_REPOSITORY
      provide: TYPEORM_PATIENT_REPOSITORY,
      useFactory(dataSource: DataSource) {
        return dataSource.getRepository(Patient);
      },
      inject: [DataSource],
    },
    PatientService, // registra o service
  ],
})
export class PatientModule {}
