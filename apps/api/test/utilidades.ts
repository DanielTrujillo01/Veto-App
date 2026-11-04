import { INestApplication, type Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DatabaseService } from '../src/database/database.service';

export type Fila = Record<string, unknown>;
export type Resultado = { rows: Fila[]; rowCount?: number };
/** Responde a cada consulta SQL de la prueba. Puede lanzar un error con `code` para simular PostgreSQL. */
export type Manejador = (sql: string, valores: unknown[]) => Resultado | undefined;

export type UsuarioPrueba = {
  id: string;
  nombre: string;
  correo: string;
  celular: string;
  rol: string;
};

export const TUTOR: UsuarioPrueba = {
  id: '11111111-1111-4111-8111-111111111111',
  nombre: 'Ana Tutor',
  correo: 'ana@mail.com',
  celular: '3001112233',
  rol: 'TUTOR',
};
export const ALIADO: UsuarioPrueba = {
  id: '22222222-2222-4222-8222-222222222222',
  nombre: 'Clínica Admin',
  correo: 'clinica@mail.com',
  celular: '3002223344',
  rol: 'ALIADO',
};

/** Cookie de sesión que el AuthGuard acepta en las pruebas. */
export const COOKIE = 'veto_session=token-de-prueba';

/**
 * Base de datos simulada: registra cada consulta (con su transacción) y delega las respuestas
 * en `manejador`. La consulta de sesión del AuthGuard devuelve `usuario`.
 */
export function crearBdFalsa(manejador: Manejador, usuario: UsuarioPrueba | null = TUTOR) {
  const consultas: { sql: string; valores: unknown[]; usuarioTx: string | null }[] = [];
  const ejecutar = async (sql: string, valores: unknown[] = [], usuarioTx: string | null) => {
    consultas.push({ sql, valores, usuarioTx });
    if (sql.includes('FROM sesion s')) {
      return { rows: usuario ? [usuario] : [], rowCount: usuario ? 1 : 0 };
    }
    const r = manejador(sql, valores) ?? { rows: [] };
    return { rows: r.rows, rowCount: r.rowCount ?? r.rows.length };
  };
  const db = {
    query: jest.fn((sql: string, valores?: unknown[]) => ejecutar(sql, valores, null)),
    withUser: jest.fn(async (usuarioId: string | null, fn: (c: unknown) => Promise<unknown>) => {
      const client = {
        query: (sql: string, valores?: unknown[]) => ejecutar(sql, valores, usuarioId),
      };
      return fn(client);
    }),
    ping: jest.fn(async () => true),
  };
  return { db, consultas };
}

export async function crearApp(modulos: Type[], db: unknown): Promise<INestApplication> {
  const modulo = await Test.createTestingModule({ imports: modulos })
    .useMocker((token) => {
      if (token === DatabaseService) return db;
    })
    .compile();
  const app = modulo.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}

/** Error con el código de PostgreSQL indicado. */
export function errorPg(code: string, constraint?: string): Error {
  return Object.assign(new Error(`pg ${code}`), { code, constraint });
}
