import { Module } from '@nestjs/common';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';
import { PaymentModule } from '../payments/payment.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [PaymentModule, NotificationsModule, OrganizationsModule],
  controllers: [OffersController],
  providers: [OffersService],
})
export class OffersModule {}
