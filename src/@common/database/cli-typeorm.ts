import 'dotenv/config';
import { DataSource } from 'typeorm';

import { ENTITIES } from './typeorm';
import { SnakeCaseNamingStrategy } from './snake-case-naming-pattern';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  synchronize: false,
  ssl: process.env.DB_SSL === 'true',
  entities: ENTITIES,
  namingStrategy: new SnakeCaseNamingStrategy(),
  migrations: [__dirname + '/migrations/**/*{.js,.ts}'],
});
