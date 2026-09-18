import { Module } from '@nestjs/common';
import { ArtworksController } from './artworks.controller';
import { ArtworksService } from './artworks.service';
import { ArtistProfilesModule } from '../artist-profiles/artist-profiles.module';
import { R2Module } from '../common/r2/r2.module';

@Module({
  imports: [ArtistProfilesModule, R2Module],
  controllers: [ArtworksController],
  providers: [ArtworksService],
  exports: [ArtworksService],
})
export class ArtworksModule {}
