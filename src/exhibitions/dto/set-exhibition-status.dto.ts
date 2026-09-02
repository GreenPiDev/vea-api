import { IsIn } from 'class-validator';

// DRAFT is also owner-settable now (ACTIVE -> DRAFT, "Yayından Kaldır") —
// it's just never a valid *target* from the initial creation-time DRAFT
// itself. See exhibitions.service.ts's ALLOWED_TRANSITIONS for the actual
// per-status state machine this DTO doesn't encode.
export const OWNER_SETTABLE_EXHIBITION_STATUSES = ['ACTIVE', 'ENDED', 'DRAFT'] as const;

export class SetExhibitionStatusDto {
  @IsIn(OWNER_SETTABLE_EXHIBITION_STATUSES)
  status: (typeof OWNER_SETTABLE_EXHIBITION_STATUSES)[number];
}
