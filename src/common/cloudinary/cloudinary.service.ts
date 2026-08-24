import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private readonly envFolder: string;

  constructor(private readonly config: ConfigService) {
    cloudinary.config({
      cloud_name: config.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: config.get<string>('CLOUDINARY_API_KEY'),
      api_secret: config.get<string>('CLOUDINARY_API_SECRET'),
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
    resourceType: 'image' | 'auto' = 'image',
  ): Promise<string> {
    const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: `VEA/${this.envFolder}/${folder}`,
      resource_type: resourceType,
    });
    return result.secure_url;
  }
}
