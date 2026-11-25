import { Controller, Get } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { bigintJsonReplacer } from './bigint-json';

// Same registration as main.ts — proves Nest actually routes object
// responses through Express's res.json (and so the replacer). Without it a
// controller returning a Prisma row with a BIGINT column is a 500
// ("Do not know how to serialize a BigInt").
@Controller()
class MoneyTestController {
  @Get('artwork')
  artwork() {
    return { id: 'a1', priceAmount: 5_000_000_000n, offers: [{ amount: 1n }] };
  }
}

describe('bigint JSON replacer (HTTP)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MoneyTestController],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.set('json replacer', bigintJsonReplacer);
    await app.init();
  });

  afterAll(() => app.close());

  it('returns BIGINT money values as plain JSON numbers', async () => {
    const res = await request(app.getHttpServer()).get('/artwork');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 'a1',
      priceAmount: 5_000_000_000,
      offers: [{ amount: 1 }],
    });
  });
});
