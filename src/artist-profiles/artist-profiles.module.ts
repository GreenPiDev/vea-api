import { Module } from '@nestjs/common';
import { ArtistProfilesController } from './artist-profiles.controller';
import { ArtistProfilesService } from './artist-profiles.service';

@Module({
  controllers: [ArtistProfilesController],
  providers: [ArtistProfilesService],
  exports: [ArtistProfilesService],
})
export class ArtistProfilesModule {}
