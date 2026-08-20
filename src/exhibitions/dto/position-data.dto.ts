import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * ExhibitionArtwork.positionData stays an opaque Json column (no migration
 * for shape changes), but is validated here — deliberately minimal: the real
 * x/y/z world position and rotationY are NEVER stored, they're always
 * recomputed client-side from vea-frontend's galleryLayout.ts geometry (the
 * single source of truth for room shape) using wallRunId + the sibling
 * top-level `order` column. Storing computed coordinates would let them
 * drift out of sync if a room's cells are ever edited later.
 *
 * `wallRunId` refers to a CustomWallRun/WallSegment id produced by
 * buildRoomLayout/buildCustomRoomLayout for the owning exhibition's
 * sceneConfig — not validated against the room here (frontend's concern at
 * placement time), only shape-checked.
 *
 * `order` (an artwork's position among possibly multiple artworks hung on
 * the same wall run) deliberately does NOT live in here — ExhibitionArtwork
 * already has a plain `order: Int?` column for it (see AddArtworkToExhibitionDto
 * / UpdateExhibitionArtworkDto), so it isn't duplicated inside this JSON blob
 * where it could drift out of sync with the column.
 *
 * `heightY` (2026-08-20): optional hang-center height override, in meters
 * from the floor. Without it, vea-frontend's placeArtworksAlongWall() derives
 * a height from a fixed floor-clearance formula — same gap for every
 * artwork regardless of size, which doesn't match real curatorial intent
 * (a small piece often hangs higher, a large one lower, at the curator's
 * discretion). When set, the frontend uses this value directly instead of
 * the formula (still clamped to the room's ceiling margin).
 */
export class ArtworkPositionDataDto {
  @IsString()
  wallRunId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  heightY?: number;
}
