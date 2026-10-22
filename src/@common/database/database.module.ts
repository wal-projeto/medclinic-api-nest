import { Global, Module } from '@nestjs/common';

import { databaseProvider } from './typeorm';

@Global()
@Module({
  providers: [databaseProvider],
  exports: [databaseProvider],
})
export class DatabaseModule {}
