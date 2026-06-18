import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { RedisIoAdapter } from './infra/socket/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
      .setTitle('Saarthi API')
      .setDescription('Saarthi school transport management API')
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
  console.warn(`🚀 Saarthi API running on http://localhost:${port}/api/v1`);
  console.warn(`📖 Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
