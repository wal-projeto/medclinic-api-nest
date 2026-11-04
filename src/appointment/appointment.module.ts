import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DoctorModule } from '../doctor/doctor.module';
import { PatientModule } from '../patient/patient.module';
import { Appointment } from './appointment.entity';
import { AppointmentController } from './appointment.controller';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { AppointmentRepository } from './appointment.repository';
import {
  AppointmentTypeormRepository,
  TYPEORM_APPOINTMENT_REPOSITORY,
} from './appointment-typeorm.repository';
import { AppointmentRulesService } from './appointment-rules.service';
import { AppointmentService } from './appointment.service';

@Module({
  imports: [DoctorModule, PatientModule], // trazem as portas DoctorRepository, WorkScheduleRepository e PatientRepository, e o WorkScheduleService (cada módulo os exporta)
  controllers: [AppointmentController, CalendarController],
  providers: [
    // quando alguém pedir um AppointmentRepository, entregue um AppointmentTypeormRepository
    { provide: AppointmentRepository, useClass: AppointmentTypeormRepository },
    {
      // fabrica o Repository<Appointment> do TypeORM a partir da conexão global e guarda com a etiqueta
      provide: TYPEORM_APPOINTMENT_REPOSITORY,
      useFactory(dataSource: DataSource) {
        return dataSource.getRepository(Appointment);
      },
      inject: [DataSource],
    },
    AppointmentRulesService,
    AppointmentService,
    CalendarService,
  ],
})
export class AppointmentModule {}
