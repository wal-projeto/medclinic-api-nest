import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './env';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { AppExceptionFilter } from './@common/filters/app-exception.filter';
import { HealthController } from './health.controller';
import { DatabaseModule } from './@common/database/database.module';
import { AuthModule } from './auth/auth.module';
import { JwtGuard } from './auth/jwt.guard';
import { UserModule } from './user/user.module';
import { AppValidationPipe } from './@common/pipes/app-validation.pipe';
import { PatientModule } from './patient/patient.module'; // traz o módulo novo

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    DatabaseModule,
    AuthModule,
    UserModule,
    PatientModule, // A aplicaçõa passa a carregar o módulo de paciente. Com isso a rota passa a existir e a API responde 201 para criar Patient
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useClass: AppValidationPipe,
    },
    {
      provide: APP_GUARD,
      useClass: JwtGuard,
    },
  ],
})
export class AppModule {}
