import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';

// libvips' operation cache keeps decoded pixel data around between calls —
// useful for batch scripts, but in a long-running API serving one-off
// uploads it just pins memory, so it's turned off process-wide.
sharp.cache(false);

// Longest edge of the stored artwork image. 2048 px is plenty for a painting
// on a 3D gallery wall and for the detail-card lightbox, while keeping each
// painting's GPU texture around ~20 MB (with mipmaps) instead of the
// ~100 MB+ a raw 6000×4000 camera photo costs — a room holds many paintings
// and also has to run on mobile browsers.
export const ARTWORK_IMAGE_MAX_EDGE_PX = 2048;

// WEBP q90 + smartSubsample is visually lossless for artwork photos (fine
// brushwork, saturated reds that 4:2:0 chroma subsampling would smear) and
// still typically lands at a few hundred KB for a 2048 px image.
const WEBP_QUALITY = 90;

// Guards against decompression bombs: a tiny, highly-compressible file can
// declare enormous dimensions. Decoding cost scales with pixels, not file
// bytes (100 MP RGBA ≈ 400 MB of RAM), so this is the real memory cap; the
// multer file-size limit alone doesn't bound it.
export const MAX_INPUT_PIXELS = 100_000_000;

// Decoding + resizing a large photo is CPU/RAM-heavy. Capping how many run
// at once per instance keeps an event-time burst of uploads from starving
// the rest of the API (and the WebSocket gateway) on the same process.
const MAX_CONCURRENT_JOBS = 2;

export interface CompressedImage {
  buffer: Buffer;
  contentType: 'image/webp';
  extension: '.webp';
  width: number;
  height: number;
}

interface CompressOptions {
  maxEdgePx?: number;
  maxInputPixels?: number;
}

@Injectable()
export class ImageCompressionService {
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  async compressToWebp(
    input: Buffer,
    {
      maxEdgePx = ARTWORK_IMAGE_MAX_EDGE_PX,
      maxInputPixels = MAX_INPUT_PIXELS,
    }: CompressOptions = {},
  ): Promise<CompressedImage> {
    await this.acquire();
    try {
      const { data, info } = await sharp(input, {
        limitInputPixels: maxInputPixels,
        // Phones/scanners occasionally emit JPEGs with harmless trailing
        // garbage; 'error' still rejects genuinely broken files but doesn't
        // bounce those over a warning (sharp's default is 'warning').
        failOn: 'error',
      })
        // Bake the EXIF orientation into the pixels — the output carries no
        // metadata, so a portrait phone photo would otherwise end up sideways.
        .rotate()
        .resize({
          width: maxEdgePx,
          height: maxEdgePx,
          fit: 'inside',
          withoutEnlargement: true,
        })
        // Output is converted to sRGB using the embedded ICC profile (sharp's
        // default) and all metadata — including EXIF GPS location — is
        // stripped, which is also what we want for privacy.
        .webp({ quality: WEBP_QUALITY, smartSubsample: true })
        .toBuffer({ resolveWithObject: true });

      return {
        buffer: data,
        contentType: 'image/webp',
        extension: '.webp',
        width: info.width,
        height: info.height,
      };
    } catch (err) {
      throw toUserFacingError(err, maxInputPixels);
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    if (this.active < MAX_CONCURRENT_JOBS) {
      this.active++;
      return;
    }
    // The slot is handed over directly by release(), so `active` never
    // drops and re-rises in between (no window for a third job to sneak in).
    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }

  private release(): void {
    const next = this.waiting.shift();
    if (next) next();
    else this.active--;
  }
}

function toUserFacingError(err: unknown, maxInputPixels: number): Error {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('pixel limit')) {
    const megapixels = Math.round(maxInputPixels / 1_000_000);
    return new BadRequestException(
      `Görselin çözünürlüğü çok yüksek (en fazla ${megapixels} megapiksel)`,
    );
  }
  return new BadRequestException(
    'Görsel işlenemedi — dosya bozuk ya da desteklenmeyen bir formatta olabilir',
  );
}
