// Must load before AppModule (and anything it imports, e.g. the WebSocket
// gateways) is required — @WebSocketGateway's cors option is evaluated at
// import time, before Nest's DI container/ConfigModule exist, so .env needs
// to already be in process.env by then in local dev.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './realtime/redis-io.adapter';
import { getCorsOrigins } from './config/cors-origins';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: getCorsOrigins() });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const redisIoAdapter = new RedisIoAdapter(
    app,
    process.env.REDIS_URL ?? 'redis://localhost:6379',
  );
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
