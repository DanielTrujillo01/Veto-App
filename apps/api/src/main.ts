import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HoraLocalInterceptor } from './common/hora-local.interceptor';
import { ENV, type Env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const env = app.get<Env>(ENV);

  app.setGlobalPrefix('api');
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  // Las fechas y horas de todas las respuestas salen en hora de Colombia (-05:00), no en UTC.
  app.useGlobalInterceptors(new HoraLocalInterceptor());

  // Documentación OpenAPI: es el contrato entre la API y la web.
  const documento = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('Veto API').setVersion('0.1.0').build(),
  );
  SwaggerModule.setup('api/docs', app, documento);

  await app.listen(env.API_PORT);
  console.log(`API lista en http://localhost:${env.API_PORT}/api  (docs: /api/docs)`);
}

void bootstrap();
