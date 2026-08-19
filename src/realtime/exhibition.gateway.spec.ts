import type { Server, Socket } from 'socket.io';
import { ExhibitionGateway } from './exhibition.gateway';
import { SOCKET_EVENTS } from './socket-events';
import { PrismaService } from '../prisma/prisma.service';

describe('ExhibitionGateway', () => {
  let prisma: {
    exhibition: { findUnique: jest.Mock<Promise<unknown>, [unknown]> };
    visitEvent: { create: jest.Mock<Promise<unknown>, [unknown]> };
  };
  let gateway: ExhibitionGateway;
  let rooms: Map<string, Set<string>>;
  let emittedTo: { room: string; event: string; payload: unknown }[];

  function makeClient(id: string) {
    return {
      id,
      data: {} as { exhibitionId?: string },
      emit: jest.fn<void, [string, unknown]>(),
      join: jest.fn<Promise<void>, [string]>((room: string) => {
        if (!rooms.has(room)) rooms.set(room, new Set());
        rooms.get(room)!.add(id);
        return Promise.resolve();
      }),
      leave: jest.fn<Promise<void>, [string]>((room: string) => {
        rooms.get(room)?.delete(id);
        return Promise.resolve();
      }),
    };
  }
  type MockClient = ReturnType<typeof makeClient>;
  const asSocket = (client: MockClient) => client as unknown as Socket;

  beforeEach(() => {
    rooms = new Map();
    emittedTo = [];
    prisma = {
      exhibition: { findUnique: jest.fn<Promise<unknown>, [unknown]>() },
      visitEvent: {
        create: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
      },
    };
    gateway = new ExhibitionGateway(prisma as unknown as PrismaService);
    gateway.server = {
      sockets: { adapter: { rooms } },
      to: (room: string) => ({
        emit: (event: string, payload: unknown) =>
          emittedTo.push({ room, event, payload }),
      }),
    } as unknown as Server;
  });

  describe('handleJoin', () => {
    it('rejects a missing exhibitionId without touching the DB', async () => {
      const client = makeClient('sock-1');
      await gateway.handleJoin(asSocket(client), { exhibitionId: '' });

      expect(client.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ExhibitionError, {
        message: 'exhibitionId is required',
      });
      expect(prisma.exhibition.findUnique).not.toHaveBeenCalled();
    });

    it('rejects a nonexistent or non-ACTIVE exhibition', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce({
        id: 'exh-1',
        status: 'DRAFT',
      });
      const client = makeClient('sock-1');
      await gateway.handleJoin(asSocket(client), { exhibitionId: 'exh-1' });

      expect(client.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ExhibitionError, {
        message: 'Exhibition not found or not active',
      });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('joins the room, logs a VisitEvent, and broadcasts the new count', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce({
        id: 'exh-1',
        status: 'ACTIVE',
      });
      const client = makeClient('sock-1');
      await gateway.handleJoin(asSocket(client), { exhibitionId: 'exh-1' });

      expect(client.join).toHaveBeenCalledWith('exhibition:exh-1');
      expect(prisma.visitEvent.create).toHaveBeenCalledWith({
        data: {
          exhibitionId: 'exh-1',
          sessionId: 'sock-1',
          eventType: 'EXHIBITION_ENTER',
        },
      });
      expect(emittedTo).toContainEqual({
        room: 'exhibition:exh-1',
        event: SOCKET_EVENTS.ExhibitionVisitorCount,
        payload: { exhibitionId: 'exh-1', count: 1 },
      });
    });

    it('broadcasts an incremented count when a second visitor joins the same room', async () => {
      prisma.exhibition.findUnique.mockResolvedValue({
        id: 'exh-1',
        status: 'ACTIVE',
      });
      const client1 = makeClient('sock-1');
      const client2 = makeClient('sock-2');
      await gateway.handleJoin(asSocket(client1), { exhibitionId: 'exh-1' });
      await gateway.handleJoin(asSocket(client2), { exhibitionId: 'exh-1' });

      expect(emittedTo.at(-1)).toEqual({
        room: 'exhibition:exh-1',
        event: SOCKET_EVENTS.ExhibitionVisitorCount,
        payload: { exhibitionId: 'exh-1', count: 2 },
      });
    });

    it('leaves the previous exhibition room when switching to a new one', async () => {
      prisma.exhibition.findUnique.mockResolvedValue({
        id: 'exh-x',
        status: 'ACTIVE',
      });
      const client = makeClient('sock-1');
      await gateway.handleJoin(asSocket(client), { exhibitionId: 'exh-1' });
      await gateway.handleJoin(asSocket(client), { exhibitionId: 'exh-2' });

      expect(client.leave).toHaveBeenCalledWith('exhibition:exh-1');
      expect(rooms.get('exhibition:exh-1')?.size ?? 0).toBe(0);
      expect(rooms.get('exhibition:exh-2')?.size).toBe(1);
    });
  });

  describe('handleLeave / handleDisconnect', () => {
    it('handleLeave removes the socket and broadcasts the decremented count', async () => {
      prisma.exhibition.findUnique.mockResolvedValue({
        id: 'exh-1',
        status: 'ACTIVE',
      });
      const client = makeClient('sock-1');
      await gateway.handleJoin(asSocket(client), { exhibitionId: 'exh-1' });
      await gateway.handleLeave(asSocket(client));

      expect(client.leave).toHaveBeenCalledWith('exhibition:exh-1');
      expect(emittedTo.at(-1)).toEqual({
        room: 'exhibition:exh-1',
        event: SOCKET_EVENTS.ExhibitionVisitorCount,
        payload: { exhibitionId: 'exh-1', count: 0 },
      });
    });

    it('handleDisconnect broadcasts the count for whatever room the socket was in', async () => {
      prisma.exhibition.findUnique.mockResolvedValue({
        id: 'exh-1',
        status: 'ACTIVE',
      });
      const client = makeClient('sock-1');
      await gateway.handleJoin(asSocket(client), { exhibitionId: 'exh-1' });
      rooms.get('exhibition:exh-1')?.delete('sock-1'); // simulate Socket.IO's own disconnect cleanup

      gateway.handleDisconnect(asSocket(client));

      expect(emittedTo.at(-1)).toEqual({
        room: 'exhibition:exh-1',
        event: SOCKET_EVENTS.ExhibitionVisitorCount,
        payload: { exhibitionId: 'exh-1', count: 0 },
      });
    });

    it('handleDisconnect is a no-op for a socket that never joined a room', () => {
      const client = makeClient('sock-1');
      gateway.handleDisconnect(asSocket(client));
      expect(emittedTo).toHaveLength(0);
    });
  });
});
