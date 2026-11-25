import { NOTIFICATION_TYPES } from './notification-types';
import { SOCKET_EVENTS } from '../realtime/socket-events';

// Contract test: these strings are matched literally by vea-frontend and
// vea-app-react-native (separate repos, no shared package), so a rename here
// compiles fine but silently breaks the clients — live list refresh and the
// notification bell's messages just stop working.
//
// If this test fails, you changed a cross-repo contract. Don't just update the
// expected values: update vea-frontend (src/lib/socket/socketEvents.ts,
// src/lib/socket/useRealtimeQuerySync.ts,
// src/components/notifications/NotificationBell.tsx) and the mobile client in
// the same change, THEN update this test.
describe('cross-repo contract', () => {
  it('Notification.type values are unchanged', () => {
    expect(NOTIFICATION_TYPES).toEqual({
      OfferCreated: 'OFFER_CREATED',
      OfferDecision: 'OFFER_DECISION',
      ArtworkRemovalRequested: 'ARTWORK_REMOVAL_REQUESTED',
      ArtworkRemovalDecided: 'ARTWORK_REMOVAL_DECIDED',
    });
  });

  it('Socket.IO event names are unchanged', () => {
    expect(SOCKET_EVENTS).toEqual({
      ExhibitionJoin: 'exhibition:join',
      ExhibitionLeave: 'exhibition:leave',
      ExhibitionWatch: 'exhibition:watch',
      ExhibitionUnwatch: 'exhibition:unwatch',
      ExhibitionVisitorCount: 'exhibition:visitorCount',
      ExhibitionError: 'exhibition:error',
      NotificationCreated: 'notification:created',
    });
  });
});
