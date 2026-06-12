import { IoAdapter } from '@nestjs/platform-socket.io';
import type { INestApplicationContext } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import type { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

/**
 * Socket.IO adapter backed by Redis pub/sub so that room fan-out works across
 * multiple API instances (NFR-02 horizontal scale). Falls back gracefully:
 * if Redis can't be reached the server still runs single-instance.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(opts: { host: string; port: number; password?: string }): Promise<void> {
    const pubClient = new Redis({
      host: opts.host,
      port: opts.port,
      password: opts.password || undefined,
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });
    const subClient = pubClient.duplicate();
    pubClient.on('error', (err) => this.logger.error(`Redis pub error: ${err.message}`));
    subClient.on('error', (err) => this.logger.error(`Redis sub error: ${err.message}`));

    await Promise.all([pubClient.connect(), subClient.connect()]);
    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log('Socket.IO Redis adapter connected');
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) server.adapter(this.adapterConstructor);
    return server;
  }
}
