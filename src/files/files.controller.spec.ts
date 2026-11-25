import {
  THROTTLER_LIMIT,
  THROTTLER_TTL,
} from '@nestjs/throttler/dist/throttler.constants';
import { FILES_RATE_LIMIT, FilesController } from './files.controller';

describe('FilesController rate limit', () => {
  it('overrides the global limit with its own, much higher one', () => {
    expect(
      Reflect.getMetadata(`${THROTTLER_LIMIT}default`, FilesController),
    ).toBe(FILES_RATE_LIMIT.limit);
    expect(
      Reflect.getMetadata(`${THROTTLER_TTL}default`, FilesController),
    ).toBe(FILES_RATE_LIMIT.ttl);
    // An exhibition load (~20 images + thumbnails) must fit many times over.
    expect(FILES_RATE_LIMIT.limit).toBeGreaterThanOrEqual(500);
  });
});
