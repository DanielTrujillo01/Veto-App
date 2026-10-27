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
        new Pool({
          connectionString: env.DATABASE_URL,
          // Supabase requiere TLS; la base local de Docker puede seguir usando una conexión sin TLS.
          ssl: env.DATABASE_URL.includes('.supabase.co') ? { rejectUnauthorized: false } : undefined,
          options: '-c search_path=veto,public',
          connectionTimeoutMillis: 10_000,
          max: 10,
        }),
    },
    DatabaseService,
  ],
  exports: [DatabaseService],
})
export class DatabaseModule {}
