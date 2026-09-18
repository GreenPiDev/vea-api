import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { R2Service } from '../common/r2/r2.service';

// R2's public r2.dev domain is unreliable for real browsers
// (ERR_SSL_PROTOCOL_ERROR) and has no CORS support for the bucket admin
// scope this app's R2 token has, so image bytes are proxied through our
// own (already-TLS-terminated, already-CORS-configured) domain instead.
// Public/unauthenticated — same visibility model as GET /exhibitions,
// artwork images are meant to be publicly viewable.
@Controller('files')
export class FilesController {
  constructor(private readonly r2: R2Service) {}

  @Get()
  async getFile(
    @Query('key') key: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (!key || !key.startsWith('VEA/')) {
      throw new BadRequestException('Invalid key');
    }
    const { body, contentType } = await this.r2.getObject(key);
    res.set({
      'Content-Type': contentType ?? 'application/octet-stream',
      // Keys are content-addressed (random UUID filename, never reused),
      // so the response can be cached forever.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    return new StreamableFile(body);
  }
}
