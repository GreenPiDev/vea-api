import { Module } from '@nestjs/common';
import { ExhibitionsController } from './exhibitions.controller';
import { ExhibitionsService } from './exhibitions.service';

@Module({
  controllers: [ExhibitionsController],
  providers: [ExhibitionsService],
})
export class ExhibitionsModule {}
