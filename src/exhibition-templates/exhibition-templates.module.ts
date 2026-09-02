import { Module } from '@nestjs/common';
import { ExhibitionTemplatesController } from './exhibition-templates.controller';
import { ExhibitionTemplatesService } from './exhibition-templates.service';

@Module({
  controllers: [ExhibitionTemplatesController],
  providers: [ExhibitionTemplatesService],
  exports: [ExhibitionTemplatesService],
})
export class ExhibitionTemplatesModule {}
