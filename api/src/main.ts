import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { uploadDir, videoKey } from './common/util';
import { validationErrors } from './common/validation';

async function bootstrap() {
  // rawBody: Razorpay's webhook is checked against the exact bytes it sent
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.setGlobalPrefix('api');
  const origins = (process.env.CORS_ORIGINS || 'http://127.0.0.1:5000,http://localhost:5000').split(',').map((o) => o.trim());
  app.enableCors({ origin: origins.includes('*') ? true : origins });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, exceptionFactory: validationErrors }));
  // Uploaded lesson videos and theme pictures are public, so installed apps can download them.
  // Lesson videos only download with their key (see videoKey): no key, no video, so a paid theme's locked videos stay
  // on the server until the family buys the theme.
  app.use('/media/videos', (req: Request, res: Response, next: NextFunction) => {
    let file = '';
    try { file = decodeURIComponent(req.path.replace(/^\/+/, '')); } catch { /* a broken address: refused below */ }
    const k = typeof req.query.k === 'string' ? req.query.k : '';
    if (!file || file.includes('/') || k.length !== 32 || !timingSafeEqual(Buffer.from(k), Buffer.from(videoKey(file)))) {
      res.status(403).type('text/plain').send('This video is locked.');
      return;
    }
    next();
  });
  // the website's /learn page is "cross-origin isolated" (it runs Python in the browser): it may show these pictures and
  // videos even when its address differs slightly from the API's (adathecoder.com and www.adathecoder.com)
  const corp = { setHeaders: (res: Response) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin') };
  app.useStaticAssets(uploadDir('videos'), { prefix: '/media/videos/', ...corp });
  app.useStaticAssets(uploadDir('courses'), { prefix: '/media/courses/', ...corp });
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  await app.listen(port, host);
  // Lesson videos can take a long time to upload on a home connection. Node ends a request after 5 minutes by
  // default (requestTimeout), which cut big uploads off half way: allow up to an hour instead.
  const server = app.getHttpServer();
  server.requestTimeout = 60 * 60 * 1000;
  server.headersTimeout = 2 * 60 * 1000;
  server.timeout = 0;
  Logger.log(`Ada The Coder API on http://${host}:${port}/api`, 'Bootstrap');
}
bootstrap();
