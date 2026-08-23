import { Module } from '@nestjs/common';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';
import { PaymentModule } from '../payments/payment.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PaymentModule, NotificationsModule],
  controllers: [OffersController],
  providers: [OffersService],
})
export class OffersModule {}
