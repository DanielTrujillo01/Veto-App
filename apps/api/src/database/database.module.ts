import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { ENV, type Env } from '../config/env';
import { DatabaseService, PG_POOL } from './database.service';
import { OPCIONES_DE_SESION, prepararConexiones } from './sesion';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ENV],
      // search_path (esquema "veto") y zona horaria (Colombia) de cada conexión, por opciones y
      // por SQL al conectar (el pooler de Supabase ignora la zona de las opciones): ver ./sesion.
      useFactory: (env: Env) =>
        prepararConexiones(
          new Pool({
            connectionString: env.DATABASE_URL,
            // Supabase requiere TLS; la base local de Docker puede seguir usando una conexión sin TLS.
            ssl: env.DATABASE_URL.includes('.supabase.co')
              ? { rejectUnauthorized: false }
              : undefined,
            options: OPCIONES_DE_SESION,
            connectionTimeoutMillis: 10_000,
            max: 10,
          }),
        ),
    },
    DatabaseService,
  ],
  exports: [DatabaseService],
})
export class DatabaseModule {}
