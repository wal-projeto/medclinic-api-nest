import { FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { APIEnv, DbLogLevel } from '../../env';
import { User } from '../../user/user.entity';
import { Patient } from '../../patient/patient.entity';
import { Doctor } from '../../doctor/doctor.entity';
import { WorkShift } from '../../doctor/work-shift.entity';
import { Appointment } from '../../appointment/appointment.entity';
import { SnakeCaseNamingStrategy } from './snake-case-naming-pattern';

export const ENTITIES = [User, Patient, Doctor, WorkShift, Appointment];

export const databaseProvider: FactoryProvider = {
  provide: DataSource,
  async useFactory(configService: ConfigService<APIEnv>) {
    const dataSource = new DataSource({
      type: 'postgres',
      host: configService.getOrThrow('DB_HOST'),
      port: configService.getOrThrow('DB_PORT'),
      username: configService.getOrThrow('DB_USER'),
      password: configService.getOrThrow('DB_PASSWORD'),
      database: configService.getOrThrow('DB_NAME'),
      synchronize: false,
      logging: [configService.getOrThrow<DbLogLevel>('DB_LOG_LEVEL')],
      ssl: configService.getOrThrow('DB_SSL'),
      entities: ENTITIES,
      namingStrategy: new SnakeCaseNamingStrategy(),
      migrations: [__dirname + '/migrations/**/*{.js,.ts}'],
    });

    await dataSource.initialize();
    await dataSource.runMigrations();

    return dataSource;
  },
  inject: [ConfigService],
};
