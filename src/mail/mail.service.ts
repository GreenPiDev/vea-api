import { Injectable, Logger } from '@nestjs/common';

/**
 * No email provider is wired up yet — this logs the code so local/dev auth
 * flows work end-to-end. Swap the body for a real provider (ör. Resend, SES)
 * without touching AuthService, which only depends on this interface.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  sendVerificationCode(email: string, code: string): Promise<void> {
    this.logger.log(`Verification code for ${email}: ${code}`);
    return Promise.resolve();
  }
}
