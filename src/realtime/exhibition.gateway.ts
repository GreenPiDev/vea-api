import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

interface JoinExhibitionPayload {
  exhibitionId: string;
}

interface SocketData {
  exhibitionId?: string;
}

function roomName(exhibitionId: string): string {
  return `exhibition:${exhibitionId}`;
}

function socketData(client: Socket): SocketData {
  return client.data as SocketData;
}

/**
 * MVP scope only: per-exhibition "room" + live visitor count (the "Ziyaretçi
 * sayacı" feature from the meeting notes' MVP list). Anonymous — browsing an
 * exhibition doesn't require auth, matching the public REST endpoints.
 *
 * Deliberately NOT built here (Faz 2, see vea-api/CLAUDE.md): multi-user
 * avatar/movement sync, sanal kokteyl, artwork-level view-duration tracking.
 * This gateway just establishes the room/broadcast plumbing those features
 * will reuse later.
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class ExhibitionGateway implements OnGatewayDisconnect {
  private readonly logger = new Logger(ExhibitionGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly prisma: PrismaService) {}

  @SubscribeMessage('exhibition:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinExhibitionPayload,
  ): Promise<void> {
    const exhibitionId = payload?.exhibitionId;
    if (!exhibitionId) {
      client.emit('exhibition:error', { message: 'exhibitionId is required' });
      return;
    }

    const exhibition = await this.prisma.exhibition.findUnique({
      where: { id: exhibitionId },
    });
    if (!exhibition || exhibition.status !== 'ACTIVE') {
      client.emit('exhibition:error', {
        message: 'Exhibition not found or not active',
      });
      return;
    }

    const data = socketData(client);

    // A socket only ever represents one visitor in one exhibition at a time
    // for this MVP — leave whatever room it was in before switching.
    const previous = data.exhibitionId;
    if (previous && previous !== exhibitionId) {
      await this.leaveRoom(client, previous);
    }

    await client.join(roomName(exhibitionId));
    data.exhibitionId = exhibitionId;

    await this.prisma.visitEvent.create({
      data: {
        exhibitionId,
        sessionId: client.id,
        eventType: 'EXHIBITION_ENTER',
      },
    });

    this.broadcastCount(exhibitionId);
  }

  @SubscribeMessage('exhibition:leave')
  async handleLeave(@ConnectedSocket() client: Socket): Promise<void> {
    const exhibitionId = socketData(client).exhibitionId;
    if (exhibitionId) {
      await this.leaveRoom(client, exhibitionId);
    }
  }

  handleDisconnect(client: Socket): void {
    const exhibitionId = socketData(client).exhibitionId;
    if (exhibitionId) {
      // Socket.IO already removes the socket from all rooms on disconnect;
      // we just need to recompute and broadcast the now-smaller count.
      this.broadcastCount(exhibitionId);
    }
  }

  private async leaveRoom(client: Socket, exhibitionId: string): Promise<void> {
    await client.leave(roomName(exhibitionId));
    socketData(client).exhibitionId = undefined;
    this.broadcastCount(exhibitionId);
  }

  private broadcastCount(exhibitionId: string): void {
    const room = roomName(exhibitionId);
    const count = this.server.sockets.adapter.rooms.get(room)?.size ?? 0;
    this.server
      .to(room)
      .emit('exhibition:visitorCount', { exhibitionId, count });
  }
}
