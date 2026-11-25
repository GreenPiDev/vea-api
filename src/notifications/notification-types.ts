// Single source of truth for Notification.type strings. Services import from
// here instead of keeping private string constants, so the contract test
// (notification-types.contract.spec.ts) covers every type in one place.
//
// These values are a cross-repo contract: vea-frontend matches on them
// (src/lib/socket/useRealtimeQuerySync.ts picks which lists to refetch,
// src/components/notifications/NotificationBell.tsx picks the message) and
// vea-app-react-native will too. Renaming or adding one here means updating
// those clients in the same change — separate repos, no shared package.
export const NOTIFICATION_TYPES = {
  OfferCreated: 'OFFER_CREATED',
  OfferDecision: 'OFFER_DECISION',
  ArtworkRemovalRequested: 'ARTWORK_REMOVAL_REQUESTED',
  ArtworkRemovalDecided: 'ARTWORK_REMOVAL_DECIDED',
} as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];
