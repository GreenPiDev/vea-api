import { Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { INestApplicationContext } from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, type RedisClientType } from 'redis';
import type { Server, ServerOptions } from 'socket.io';

/**
 * Lets multiple vea-api instances share Socket.IO room membership (and thus
 * visitor counts / broadcasts) via Redis pub/sub — required for horizontal
 * scaling during traffic spikes (etkinlik anları), see vea-api/CLAUDE.md.
 *
 * Falls back to Socket.IO's default in-memory adapter (single-instance only)
 * if Redis is unreachable at boot, rather than crashing the whole app — a
 * single dev/staging instance works fine without Redis.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(
    app: INestApplicationContext,
    private readonly redisUrl: string,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    try {
      const pubClient: RedisClientType = createClient({ url: this.redisUrl });
      const subClient: RedisClientType = pubClient.duplicate();
      pubClient.on('error', (err) =>
        this.logger.error(`Redis pub client error: ${String(err)}`),
      );
      subClient.on('error', (err) =>
        this.logger.error(`Redis sub client error: ${String(err)}`),
      );
      await Promise.all([pubClient.connect(), subClient.connect()]);
      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log('Connected to Redis for Socket.IO adapter');
    } catch (err) {
      this.logger.warn(
        `Could not connect to Redis (${this.redisUrl}); falling back to single-instance in-memory adapter. ${String(err)}`,
      );
    }
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
