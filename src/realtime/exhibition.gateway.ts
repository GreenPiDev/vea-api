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
import { SOCKET_EVENTS } from './socket-events';

interface JoinExhibitionPayload {
  exhibitionId: string;
}

interface SocketData {
  exhibitionId?: string;
}

function roomName(exhibitionId: string): string {
  return `exhibition:${exhibitionId}`;
}

// A separate room for clients that just want to read the live count (e.g.
// the exhibition selector screen showing a badge per card) without being
// counted as an actual visitor themselves — broadcastCount() sends to both
// rooms, but the count itself is always derived from roomName()'s size only.
function watcherRoomName(exhibitionId: string): string {
  return `exhibition:${exhibitionId}:watchers`;
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
 *
 * Event names all come from ./socket-events.ts (SOCKET_EVENTS) — never a
 * string literal here — see that file's header comment for why.
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class ExhibitionGateway implements OnGatewayDisconnect {
  private readonly logger = new Logger(ExhibitionGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly prisma: PrismaService) {}

  @SubscribeMessage(SOCKET_EVENTS.ExhibitionJoin)
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinExhibitionPayload,
  ): Promise<void> {
    const exhibitionId = payload?.exhibitionId;
    if (!exhibitionId) {
      client.emit(SOCKET_EVENTS.ExhibitionError, {
        message: 'exhibitionId is required',
      });
      return;
    }

    const exhibition = await this.prisma.exhibition.findUnique({
      where: { id: exhibitionId },
    });
    if (!exhibition || exhibition.status !== 'ACTIVE') {
      client.emit(SOCKET_EVENTS.ExhibitionError, {
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

  @SubscribeMessage(SOCKET_EVENTS.ExhibitionLeave)
  async handleLeave(@ConnectedSocket() client: Socket): Promise<void> {
    const exhibitionId = socketData(client).exhibitionId;
    if (exhibitionId) {
      await this.leaveRoom(client, exhibitionId);
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.ExhibitionWatch)
  async handleWatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinExhibitionPayload,
  ): Promise<void> {
    const exhibitionId = payload?.exhibitionId;
    if (!exhibitionId) return;
    await client.join(watcherRoomName(exhibitionId));
    // Send the current count directly to this client — broadcastCount()
    // only fires on the next real visitor join/leave, which might not
    // happen for a while, and a new watcher shouldn't wait for it.
    const count = this.server.sockets.adapter.rooms.get(roomName(exhibitionId))?.size ?? 0;
    client.emit(SOCKET_EVENTS.ExhibitionVisitorCount, { exhibitionId, count });
  }

  @SubscribeMessage(SOCKET_EVENTS.ExhibitionUnwatch)
  async handleUnwatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinExhibitionPayload,
  ): Promise<void> {
    if (payload?.exhibitionId) {
      await client.leave(watcherRoomName(payload.exhibitionId));
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
      .to([room, watcherRoomName(exhibitionId)])
      .emit(SOCKET_EVENTS.ExhibitionVisitorCount, { exhibitionId, count });
  }
}
