import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { sanitizeRequestBody } from './common/middleware/sanitize.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.use(sanitizeRequestBody);

  const webPort = process.env.WEB_PORT ?? process.env.PORT ?? '6001';
  app.enableCors({
    origin: process.env.NEXT_PUBLIC_WEB_URL ?? `http://localhost:${webPort}`,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = process.env.API_PORT ?? 6000;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}

bootstrap();
