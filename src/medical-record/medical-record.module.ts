// Responsabilidade: agrupa o prontuário: registra o controller, o service e liga a porta ao adaptador do TypeORM.

import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppointmentModule } from '../appointment/appointment.module';
import { DoctorModule } from '../doctor/doctor.module';
import { PatientModule } from '../patient/patient.module';
import { MedicalRecord } from './medical-record.entity';
import {
  MedicalRecordTypeormRepository,
  TYPEORM_MEDICAL_RECORD_REPOSITORY,
} from './medical-record-typeorm.repository';
import { MedicalRecordController } from './medical-record.controller';
import { MedicalRecordRepository } from './medical-record.repository';
import { MedicalRecordService } from './medical-record.service';

@Module({
  imports: [DoctorModule, PatientModule, AppointmentModule], // trazem as portas DoctorRepository, PatientRepository e AppointmentRepository (cada módulo as exporta)
  controllers: [MedicalRecordController],
  providers: [
    // quando alguém pedir um MedicalRecordRepository, entregue um MedicalRecordTypeormRepository
    {
      provide: MedicalRecordRepository,
      useClass: MedicalRecordTypeormRepository,
    },
    {
      // fabrica o Repository<MedicalRecord> do TypeORM a partir da conexão global e guarda com a etiqueta
      provide: TYPEORM_MEDICAL_RECORD_REPOSITORY,
      useFactory(dataSource: DataSource) {
        return dataSource.getRepository(MedicalRecord);
      },
      inject: [DataSource],
    },
    MedicalRecordService,
  ],
})
export class MedicalRecordModule {}
