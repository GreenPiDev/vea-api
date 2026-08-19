import { Module } from '@nestjs/common';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';
import { PaymentModule } from '../payments/payment.module';

@Module({
  imports: [PaymentModule],
  controllers: [OffersController],
  providers: [OffersService],
})
export class OffersModule {}
