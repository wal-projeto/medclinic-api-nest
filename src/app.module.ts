import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './env';
import { APP_FILTER } from '@nestjs/core';
import { AppExceptionFilter } from './@common/filters/app-exception.filter';


@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })],
  controllers: [AppController],
  providers: [
    AppService,
  {
    provide: APP_FILTER,
    useClass: AppExceptionFilter,
  },
],
})
export class AppModule {}
