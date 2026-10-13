import { LOG_LEVELS, type LogLevel } from '@nestjs/common';
import { plainToInstance, Type } from 'class-transformer';
import { IsIn, IsNumber, validateSync } from 'class-validator';

export function validateEnv(config: unknown) {
  const apiEnv = plainToInstance(APIEnv, config);
  const result = validateSync(apiEnv, { whitelist: true });
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
}
