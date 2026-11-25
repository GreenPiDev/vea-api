// Must load before AppModule (and anything it imports, e.g. the WebSocket
// gateways) is required — @WebSocketGateway's cors option is evaluated at
// import time, before Nest's DI container/ConfigModule exist, so .env needs
// to already be in process.env by then in local dev.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './realtime/redis-io.adapter';
import { getCorsOrigins } from './config/cors-origins';
import { bigintJsonReplacer } from './common/bigint-json';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // The container is only reachable through the reverse proxy on the host /
  // docker network (deploy.sh publishes on 127.0.0.1), so every request's
  // socket address is the proxy's. Without this, req.ip — which the
  // ThrottlerGuard keys on — was the same for every visitor: the 60/min limit
  // was shared by all of them. Only private/loopback hops are trusted, so a
  // client can't spoof its IP with its own X-Forwarded-For header.
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
  // Security headers. CORP is relaxed to cross-origin: this is an API whose
  // responses (incl. /files images used as WebGL textures) are read from the
  // frontend's own origin.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  // On SIGTERM (docker stop / redeploy) let in-flight requests finish and
  // close the DB pool / Redis cleanly instead of being cut off.
  app.enableShutdownHooks();
  // Money columns are BIGINT — serialize them as plain JSON numbers.
  app.set('json replacer', bigintJsonReplacer);
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
