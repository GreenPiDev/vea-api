import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Response } from 'express';

// FileInterceptor turns multer's LIMIT_FILE_SIZE into a PayloadTooLargeException
// carrying multer's raw English "File too large" — no limit, not localized.
// Bound per-endpoint via @UseFilters(new FileTooLargeFilter(MAX_BYTES)) so the
// response states that endpoint's actual limit. `maxBytes` is included so a
// client can render its own localized message from it.
@Catch(PayloadTooLargeException)
export class FileTooLargeFilter implements ExceptionFilter {
  constructor(private readonly maxBytes: number) {}

  catch(_exception: PayloadTooLargeException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const maxMb = Math.round(this.maxBytes / (1024 * 1024));
    response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
      statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
      error: 'Payload Too Large',
      message: `Dosya en fazla ${maxMb} MB olabilir`,
      maxBytes: this.maxBytes,
    });
  }
}
