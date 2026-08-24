import { Module } from '@nestjs/common';
import { ArtworkRemovalRequestsController } from './artwork-removal-requests.controller';
import { ArtworkRemovalRequestsService } from './artwork-removal-requests.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ExhibitionsModule } from '../exhibitions/exhibitions.module';
import { ArtworksModule } from '../artworks/artworks.module';

@Module({
  imports: [
    NotificationsModule,
    OrganizationsModule,
    ExhibitionsModule,
    ArtworksModule,
  ],
  controllers: [ArtworkRemovalRequestsController],
  providers: [ArtworkRemovalRequestsService],
})
export class ArtworkRemovalRequestsModule {}
