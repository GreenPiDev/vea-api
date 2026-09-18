import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

@Injectable()
export class R2Service {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly envFolder: string;

  constructor(private readonly config: ConfigService) {
    const accountId = config.get<string>('R2_ACCOUNT_ID');
    this.bucket = config.get<string>('R2_BUCKET_NAME')!;
    this.publicUrl = config.get<string>('R2_PUBLIC_URL')!.replace(/\/$/, '');

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.get<string>('R2_ACCESS_KEY_ID')!,
        secretAccessKey: config.get<string>('R2_SECRET_ACCESS_KEY')!,
      },
      // R2 doesn't support the AWS SDK v3 default flexible checksum headers
      // (Content-MD5/CRC32 trailers) — leaving this on the default
      // ('WHEN_SUPPORTED') makes every request fail with a 403 AccessDenied
      // caused by a signature mismatch, not a real permissions issue.
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });

    // Defaults to "development" unless NODE_ENV is explicitly "production",
    // so a local run can never accidentally write into the production
    // folder just because NODE_ENV was left unset.
    this.envFolder =
      config.get<string>('NODE_ENV') === 'production'
        ? 'production'
        : 'development';
  }

  async uploadImage(
    file: Express.Multer.File,
    folder: string,
  ): Promise<string> {
    const extension = file.originalname.includes('.')
      ? file.originalname.slice(file.originalname.lastIndexOf('.'))
      : '';
    const key = `VEA/${this.envFolder}/${folder}/${randomUUID()}${extension}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return `${this.publicUrl}/${key}`;
  }
}
