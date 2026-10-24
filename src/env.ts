import { LOG_LEVELS, type LogLevel } from '@nestjs/common';
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';

const DB_LOG_LEVELS = [
  'query',
  'schema',
  'error',
  'warn',
  'info',
  'log',
  'migration',
] as const;
export type DbLogLevel = (typeof DB_LOG_LEVELS)[number];

export function validateEnv(config: unknown) {
  const apiEnv = plainToInstance(APIEnv, config);
  const result = validateSync(apiEnv, {
    whitelist: true,
    validationError: { target: false, value: false },
  });

  if (result.length > 0) {
    throw new Error(JSON.stringify(result, null));
  }
  return apiEnv;
}

export class APIEnv {
  @Type(() => Number)
  @IsNumber()
  PORT!: number;

  @IsIn(LOG_LEVELS)
  LOG_LEVEL!: LogLevel;

  @IsString()
  DB_HOST!: string;

  @Type(() => Number)
  @IsNumber()
  DB_PORT = 5432;

  @IsString()
  DB_USER!: string;

  @IsString()
  DB_PASSWORD!: string;

  @IsString()
  DB_NAME!: string;

  @IsIn(DB_LOG_LEVELS)
  DB_LOG_LEVEL: DbLogLevel = 'error';

  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  DB_SSL = false;

  @IsOptional()
  @IsEmail()
  ADMIN_EMAIL?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  ADMIN_PASSWORD?: string;

  @IsString()
  JWT_SECRET!: string;

  @IsString()
  JWT_EXPIRES_IN = '8h';
}
