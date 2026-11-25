import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import {
  ARTWORK_IMAGE_MAX_EDGE_PX,
  ImageCompressionService,
} from './image-compression.service';

// Runs real sharp/libvips on small generated images — the behaviour under
// test (resize math, EXIF rotation, format, error mapping) lives in libvips,
// so mocking it would test nothing.
function solidImage(
  width: number,
  height: number,
  format: 'jpeg' | 'png',
  options: { alpha?: boolean; orientation?: number } = {},
): Promise<Buffer> {
  let image = sharp({
    create: {
      width,
      height,
      channels: options.alpha ? 4 : 3,
      background: options.alpha
        ? { r: 180, g: 40, b: 30, alpha: 0.5 }
        : { r: 180, g: 40, b: 30 },
    },
  });
  if (options.orientation) {
    image = image.withMetadata({ orientation: options.orientation });
  }
  return format === 'jpeg' ? image.jpeg().toBuffer() : image.png().toBuffer();
}

describe('ImageCompressionService', () => {
  let service: ImageCompressionService;

  beforeEach(() => {
    service = new ImageCompressionService();
  });

  it('outputs WEBP', async () => {
    const result = await service.compressToWebp(
      await solidImage(400, 300, 'jpeg'),
    );

    expect(result.contentType).toBe('image/webp');
    expect(result.extension).toBe('.webp');
    expect((await sharp(result.buffer).metadata()).format).toBe('webp');
  });

  it('shrinks a landscape image so its longest edge is the max, keeping aspect ratio', async () => {
    const result = await service.compressToWebp(
      await solidImage(4000, 3000, 'jpeg'),
    );

    expect(result.width).toBe(ARTWORK_IMAGE_MAX_EDGE_PX);
    expect(result.height).toBe(1536);
    const meta = await sharp(result.buffer).metadata();
    expect([meta.width, meta.height]).toEqual([2048, 1536]);
  });

  it('shrinks a portrait image by its height', async () => {
    const result = await service.compressToWebp(
      await solidImage(3000, 6000, 'jpeg'),
    );

    expect([result.width, result.height]).toEqual([1024, 2048]);
  });

  it('never enlarges an image already smaller than the max', async () => {
    const result = await service.compressToWebp(
      await solidImage(800, 600, 'png'),
    );

    expect([result.width, result.height]).toEqual([800, 600]);
  });

  it('bakes EXIF orientation into the pixels (portrait phone photo stays upright)', async () => {
    // Stored as 600×400 landscape pixels + orientation 6 (rotate 90° CW) —
    // how phones save portrait shots.
    const result = await service.compressToWebp(
      await solidImage(600, 400, 'jpeg', { orientation: 6 }),
    );

    expect([result.width, result.height]).toEqual([400, 600]);
    expect((await sharp(result.buffer).metadata()).orientation).toBeUndefined();
  });

  it('keeps transparency from a PNG', async () => {
    const result = await service.compressToWebp(
      await solidImage(200, 200, 'png', { alpha: true }),
    );

    expect((await sharp(result.buffer).metadata()).hasAlpha).toBe(true);
  });

  it('rejects a corrupt / non-image file with a Turkish 400', async () => {
    await expect(
      service.compressToWebp(Buffer.from('definitely not an image')),
    ).rejects.toThrow(
      new BadRequestException(
        'Görsel işlenemedi — dosya bozuk ya da desteklenmeyen bir formatta olabilir',
      ),
    );
  });

  it('rejects an image above the pixel limit (decompression-bomb guard) with its own message', async () => {
    await expect(
      service.compressToWebp(await solidImage(2000, 1000, 'png'), {
        maxInputPixels: 1_000_000,
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Görselin çözünürlüğü çok yüksek (en fazla 1 megapiksel)',
      ),
    );
  });

  it('keeps processing after a failed job (concurrency slot is released)', async () => {
    const bad = Buffer.from('nope');
    await Promise.allSettled([
      service.compressToWebp(bad),
      service.compressToWebp(bad),
      service.compressToWebp(bad),
    ]);

    const result = await service.compressToWebp(
      await solidImage(100, 100, 'jpeg'),
    );
    expect(result.width).toBe(100);
  });

  it('completes more simultaneous jobs than the concurrency cap', async () => {
    const input = await solidImage(1200, 900, 'jpeg');
    const results = await Promise.all(
      Array.from({ length: 5 }, () => service.compressToWebp(input)),
    );

    expect(results.map((r) => r.width)).toEqual([1200, 1200, 1200, 1200, 1200]);
  });
});
