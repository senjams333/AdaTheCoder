import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { uploadDir } from './common/util';
import { validationErrors } from './common/validation';

async function bootstrap() {
  // rawBody: Razorpay's webhook is checked against the exact bytes it sent
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.setGlobalPrefix('api');
  const origins = (process.env.CORS_ORIGINS || 'http://127.0.0.1:5000,http://localhost:5000').split(',').map((o) => o.trim());
  app.enableCors({ origin: origins.includes('*') ? true : origins });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, exceptionFactory: validationErrors }));
  // Uploaded lesson videos and theme pictures are public, so installed apps can download them.
  app.useStaticAssets(uploadDir('videos'), { prefix: '/media/videos/' });
  app.useStaticAssets(uploadDir('courses'), { prefix: '/media/courses/' });
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  await app.listen(port, host);
  Logger.log(`Ada The Coder API on http://${host}:${port}/api`, 'Bootstrap');
}
bootstrap();
