import {
  Controller,
  INestApplication,
  Post,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { memoryStorage } from 'multer';
import request from 'supertest';
import type { App } from 'supertest/types';
import { FileTooLargeFilter } from './file-too-large.filter';

const LIMIT = 1024;

// Same decorator stack as the real upload endpoints — proves the filter
// actually sees the exception FileInterceptor throws from multer (an
// interceptor-level error), not just a hand-constructed one.
@Controller()
class UploadTestController {
  @Post('upload')
  @UseFilters(new FileTooLargeFilter(LIMIT))
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: LIMIT, files: 1 },
    }),
  )
  upload(@UploadedFile() file?: Express.Multer.File) {
    return { size: file?.size };
  }
}

describe('FileTooLargeFilter (HTTP)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UploadTestController],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('returns the localized 413 body when the file exceeds the limit', async () => {
    const res = await request(app.getHttpServer() as App)
      .post('/upload')
      .attach('file', Buffer.alloc(LIMIT + 1), 'big.jpg');

    expect(res.status).toBe(413);
    // Message wording/MB formatting is covered by file-too-large.filter.spec.ts;
    // here it only matters that it's ours and not multer's "File too large".
    expect(res.body).toMatchObject({
      statusCode: 413,
      maxBytes: LIMIT,
      message: expect.stringMatching(/^Dosya en fazla/) as unknown,
    });
  });

  it('lets a file within the limit through', async () => {
    const res = await request(app.getHttpServer() as App)
      .post('/upload')
      .attach('file', Buffer.alloc(LIMIT / 2), 'ok.jpg');

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ size: LIMIT / 2 });
  });
});
