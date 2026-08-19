import { Module } from '@nestjs/common';
import { ExhibitionsController } from './exhibitions.controller';
import { ExhibitionsService } from './exhibitions.service';
import { ArtistProfilesModule } from '../artist-profiles/artist-profiles.module';

@Module({
  imports: [ArtistProfilesModule],
  controllers: [ExhibitionsController],
  providers: [ExhibitionsService],
})
export class ExhibitionsModule {}
