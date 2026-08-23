import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  findMine(@CurrentUser() user: JwtPayload) {
    return this.notifications.findMine(user.sub);
  }

  @Get('unread-count')
  async countUnread(@CurrentUser() user: JwtPayload) {
    // Wrapped in an object, not a bare number — Express sends a raw
    // string/number body as text/html (no JSON.stringify), and the
    // frontend's client.ts only parses application/json responses.
    return { count: await this.notifications.countUnread(user.sub) };
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.notifications.markRead(id, user.sub);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: JwtPayload) {
    return this.notifications.markAllRead(user.sub);
  }
}
