// Single source of truth for Socket.IO event names — every gateway must
// import from here instead of using string literals, so an event is never
// renamed on one side (emit) without the other (listener) noticing at
// compile time. vea-frontend/src/lib/socket/socketEvents.ts mirrors this
// file; the two must be kept in sync manually (separate repos, no shared
// package yet — see vea-api/CLAUDE.md).
export const SOCKET_EVENTS = {
  // Client -> Server
  ExhibitionJoin: 'exhibition:join',
  ExhibitionLeave: 'exhibition:leave',
  // Server -> Client
  ExhibitionVisitorCount: 'exhibition:visitorCount',
  ExhibitionError: 'exhibition:error',
} as const;

export type SocketEventName =
  (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
