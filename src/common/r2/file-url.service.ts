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
}
