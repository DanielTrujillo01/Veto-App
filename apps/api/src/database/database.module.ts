import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { ENV, type Env } from '../config/env';
import { DatabaseService, PG_POOL } from './database.service';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ENV],
      // search_path: las tablas viven en el esquema "veto".
      useFactory: (env: Env) =>
        new Pool({ connectionString: env.DATABASE_URL, options: '-c search_path=veto,public' }),
    },
    DatabaseService,
  ],
  exports: [DatabaseService],
})
export class DatabaseModule {}
