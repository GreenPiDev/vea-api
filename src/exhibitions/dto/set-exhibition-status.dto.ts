import { IsIn } from 'class-validator';

// DRAFT is the only creation-time status; owners can only move forward from
// there. See exhibitions.service.ts's ALLOWED_TRANSITIONS for the state machine.
export const OWNER_SETTABLE_EXHIBITION_STATUSES = ['ACTIVE', 'ENDED'] as const;

export class SetExhibitionStatusDto {
  @IsIn(OWNER_SETTABLE_EXHIBITION_STATUSES)
  status: (typeof OWNER_SETTABLE_EXHIBITION_STATUSES)[number];
}
