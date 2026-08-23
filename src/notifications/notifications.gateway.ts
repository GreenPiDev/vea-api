import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { SOCKET_EVENTS } from '../realtime/socket-events';

function userRoom(userId: string): string {
  return `user:${userId}`;
}

/**
 * Identifies the socket's user (if any) so NotificationsService can push to
 * them directly. Shares the same underlying Socket.IO server/connection as
 * ExhibitionGateway (no separate namespace) — a client only opens one
 * socket, this just adds an extra "which room(s) does this connection
 * belong to" step on top.
 *
 * Auth is optional, not required: anonymous exhibition browsing must keep
 * working on the same connection, so a missing/invalid token just means
 * this particular socket never joins a `user:<id>` room and simply never
 * receives notifications — it does not disconnect or error.
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class NotificationsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) return;

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
      await client.join(userRoom(payload.sub));
    } catch (err) {
      // Expired/invalid token — treat the same as no token, stay anonymous.
      this.logger.debug(`Socket auth failed, staying anonymous: ${String(err)}`);
    }
  }

  emitToUser(userId: string, notification: unknown): void {
    this.server.to(userRoom(userId)).emit(SOCKET_EVENTS.NotificationCreated, notification);
  }
}
