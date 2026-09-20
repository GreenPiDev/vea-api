/*
  Warnings:

  - Added the required column `artistDisplayName` to the `Artwork` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Artwork" ADD COLUMN     "artistDisplayName" TEXT;

-- Backfill existing rows from the owning ArtistProfile's own name before enforcing NOT NULL.
UPDATE "Artwork" a
SET "artistDisplayName" = p."displayName"
FROM "ArtistProfile" p
WHERE p.id = a."artistProfileId";

ALTER TABLE "Artwork" ALTER COLUMN "artistDisplayName" SET NOT NULL;
