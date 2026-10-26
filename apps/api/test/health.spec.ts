import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DatabaseService } from '../src/database/database.service';
import { HealthModule } from '../src/health/health.module';

async function crearApp(baseDeDatosArriba: boolean): Promise<INestApplication> {
  const modulo = await Test.createTestingModule({ imports: [HealthModule] })
    .useMocker((token) => {
      if (token === DatabaseService) return { ping: async () => baseDeDatosArriba };
    })
    .compile();
  const app = modulo.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}

describe('GET /api/health', () => {
  it('responde 200 cuando la base de datos está arriba', async () => {
    const app = await crearApp(true);
    const respuesta = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(respuesta.body).toEqual({ status: 'ok', db: 'up' });
    await app.close();
  });

  it('responde 503 cuando la base de datos no responde', async () => {
    const app = await crearApp(false);
    await request(app.getHttpServer()).get('/api/health').expect(503);
    await app.close();
  });
});
