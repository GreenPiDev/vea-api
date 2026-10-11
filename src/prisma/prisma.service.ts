import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        // node-postgres's pg.Pool (what this adapter wraps) defaults `max` to 10 regardless
        // of any `connection_limit` query param on DATABASE_URL — that param is a convention
        // of Prisma's own (non-adapter) connector, silently ignored here. Must be set explicitly.
        max: Number(process.env.DB_POOL_MAX) || 10,
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
