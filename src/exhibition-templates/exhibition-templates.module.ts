import { Module } from '@nestjs/common';
import { ExhibitionTemplatesController } from './exhibition-templates.controller';
import { ExhibitionTemplatesService } from './exhibition-templates.service';
import { FurnitureAssetsModule } from '../furniture-assets/furniture-assets.module';

@Module({
  imports: [FurnitureAssetsModule],
  controllers: [ExhibitionTemplatesController],
  providers: [ExhibitionTemplatesService],
  exports: [ExhibitionTemplatesService],
})
export class ExhibitionTemplatesModule {}
