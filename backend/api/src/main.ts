import * as Sentry from '@sentry/node';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { localStorageRoot, STORAGE_URL_PREFIX } from './infra/storage/storage.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { RedisIoAdapter } from './infra/socket/redis-io.adapter';

async function bootstrap() {
  // Error reporting. Behind an optional DSN so local/dev (no DSN) is a clean
  // no-op — init is skipped and Sentry.captureException calls silently do nothing.
  if (process.env.SENTRY_DSN) {
    Sentry.init({ dsn: process.env.SENTRY_DSN });
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Raise the JSON body-parser limit above Express's 100kb default: the driver
  // boarding-photo upload (POST /attendance/photo) sends a base64-encoded image
  // in the JSON body, which routinely exceeds 100kb and was being rejected with a
  // 413/500 before it reached the handler. 10mb covers a phone photo with base64
  // overhead (~33%).
  // TODO: the proper long-term fix is multipart upload via FileInterceptor (as the
  // onboarding CSV import already does) so image bytes never ride in a JSON body.
  app.useBodyParser('json', { limit: '10mb' });

  // Serve locally-stored uploads (attendance photos in Phase 3) as static files.
  // Mounted as raw express middleware so it bypasses the global response
  // interceptor — these are binary files, not JSON envelopes. Lives outside the
  // `api/v1` prefix so the stored URL is stable when real object storage lands.
  app.useStaticAssets(localStorageRoot(), { prefix: STORAGE_URL_PREFIX });

  // Socket.IO over Redis pub/sub so /tracking room fan-out spans instances.
  const redisAdapter = new RedisIoAdapter(app);
  try {
    await redisAdapter.connectToRedis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD,
    });
    app.useWebSocketAdapter(redisAdapter);
  } catch (err) {
    console.warn('⚠️  Redis adapter unavailable, falling back to in-memory Socket.IO:', err);
  }

  // CORS
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:8081'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global filters & interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Swagger
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Yaanam API')
      .setDescription('Yaanam school transport management API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT ?? 3000;
  // Bind to all interfaces — cloud hosts (Railway/Render/Fly) route to 0.0.0.0,
  // not localhost, so the container is otherwise unreachable.
  await app.listen(port, '0.0.0.0');
  console.warn(`🚀 Yaanam API running on http://localhost:${port}/api/v1`);
  console.warn(`📖 Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
