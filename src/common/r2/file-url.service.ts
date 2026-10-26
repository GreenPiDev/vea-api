import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FileUrlService {
  private readonly apiPublicUrl: string;

  constructor(config: ConfigService) {
    this.apiPublicUrl = (
      config.get<string>('API_PUBLIC_URL') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  build(key: string): string {
    return `${this.apiPublicUrl}/files?key=${encodeURIComponent(key)}`;
  }

  // Inverse of build() — extracts the R2 object key back out of a stored
  // `/files?key=...` URL, for the handful of deletion flows that only have
  // the URL (DB column) and need the key to tell R2Service what to remove.
  // Null for anything that isn't one of our own proxied URLs (e.g. a bundled
  // platform-default asset served from public/, never uploaded to R2).
  extractKey(url: string): string | null {
    try {
      return new URL(url).searchParams.get('key');
    } catch {
      return null;
    }
  }
}
