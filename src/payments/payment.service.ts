import { Injectable, Logger } from '@nestjs/common';

export interface HeldFunds {
  provider: string;
  providerRef: string;
}

/**
 * No real payment/escrow provider is wired up yet — this stub "holds" and
 * "releases" funds by logging only, so the Offer state machine can be built
 * and tested end-to-end now. Swap the body for a real provider (bloke
 * mekanizması netleşince) without touching OffersService, which only depends
 * on this interface.
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  holdFunds(
    offerId: string,
    amount: number,
    currency: string,
  ): Promise<HeldFunds> {
    this.logger.log(
      `Holding ${amount} ${currency} for offer ${offerId} (stub provider)`,
    );
    return Promise.resolve({
      provider: 'stub',
      providerRef: `stub_${offerId}`,
    });
  }

  releaseFunds(providerRef: string): Promise<void> {
    this.logger.log(`Releasing held funds ${providerRef} (stub provider)`);
    return Promise.resolve();
  }
}
