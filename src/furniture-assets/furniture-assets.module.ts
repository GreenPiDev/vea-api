import { Module } from '@nestjs/common';
import { FurnitureAssetsController } from './furniture-assets.controller';
import { FurnitureAssetsService } from './furniture-assets.service';
import { R2Module } from '../common/r2/r2.module';

@Module({
  imports: [R2Module],
  controllers: [FurnitureAssetsController],
  providers: [FurnitureAssetsService],
  exports: [FurnitureAssetsService],
})
export class FurnitureAssetsModule {}
