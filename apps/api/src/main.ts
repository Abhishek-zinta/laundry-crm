import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from './app.module';
import { API_PREFIX, configureApp } from './bootstrap';
import { env } from './config/env';

async function bootstrap() {
  const config = env();
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  configureApp(app);

  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('RinseOps API')
      .setDescription('REST API for the RinseOps laundry management platform. Authenticate via POST /auth/login (session cookie).')
      .setVersion('1.0')
      .addCookieAuth('ro_session')
      .build(),
  );
  SwaggerModule.setup(`${API_PREFIX}/docs`, app, cleanupOpenApiDoc(doc));

  await app.listen(config.API_PORT);
  Logger.log(`RinseOps API listening on http://localhost:${config.API_PORT}/${API_PREFIX}`, 'Bootstrap');
  Logger.log(`Swagger docs at http://localhost:${config.API_PORT}/${API_PREFIX}/docs`, 'Bootstrap');
}

void bootstrap();
