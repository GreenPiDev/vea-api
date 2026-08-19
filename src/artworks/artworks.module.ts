import { Module } from '@nestjs/common';
import { ArtworksController } from './artworks.controller';
import { ArtworksService } from './artworks.service';
import { ArtistProfilesModule } from '../artist-profiles/artist-profiles.module';

@Module({
  imports: [ArtistProfilesModule],
  controllers: [ArtworksController],
  providers: [ArtworksService],
})
export class ArtworksModule {}
