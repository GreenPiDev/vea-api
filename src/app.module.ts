import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validate } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ArtistProfilesModule } from './artist-profiles/artist-profiles.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ArtworksModule } from './artworks/artworks.module';
import { ExhibitionsModule } from './exhibitions/exhibitions.module';
import { ExhibitionTemplatesModule } from './exhibition-templates/exhibition-templates.module';
import { OffersModule } from './offers/offers.module';
import { RealtimeModule } from './realtime/realtime.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ArtworkRemovalRequestsModule } from './artwork-removal-requests/artwork-removal-requests.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 60 }],
    }),
    PrismaModule,
    HealthModule,
    UsersModule,
    AuthModule,
    ArtistProfilesModule,
    OrganizationsModule,
    ArtworksModule,
    ExhibitionsModule,
    ExhibitionTemplatesModule,
    OffersModule,
    RealtimeModule,
    NotificationsModule,
    ArtworkRemovalRequestsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
