import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validationErrors } from './common/validation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: (process.env.CORS_ORIGINS || '*').split(',').map((o) => o.trim()) });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, exceptionFactory: validationErrors }),
  );
  const port = Number(process.env.PORT || 3000);
  await app.listen(port, process.env.HOST || '127.0.0.1');
  Logger.log(`Ada auth API on http://${process.env.HOST || '127.0.0.1'}:${port}/api`, 'Bootstrap');
}
bootstrap();
