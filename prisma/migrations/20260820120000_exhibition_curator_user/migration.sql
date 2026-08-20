-- Exhibition ownership moves from ArtistProfile (ownerProfileId) to User
-- (curatorUserId) — admin/curator, not the artist, now owns exhibitions.
-- Existing rows are backfilled via the artist's own user id before the old
-- column is dropped, so no local test data is lost. Any exhibition curated
-- by an artist under the old model now shows that artist's user id as
-- curatorUserId; promote that user to ADMIN (or reassign) manually if needed.

-- DropForeignKey
ALTER TABLE "Exhibition" DROP CONSTRAINT "Exhibition_ownerProfileId_fkey";

-- DropIndex
DROP INDEX "Exhibition_ownerProfileId_idx";

-- AlterTable: add nullable column first so we can backfill
ALTER TABLE "Exhibition" ADD COLUMN "curatorUserId" TEXT;

-- Backfill from the ArtistProfile that used to own each exhibition
UPDATE "Exhibition" e
SET "curatorUserId" = ap."userId"
FROM "ArtistProfile" ap
WHERE ap.id = e."ownerProfileId";

-- Enforce NOT NULL now that every row is backfilled
ALTER TABLE "Exhibition" ALTER COLUMN "curatorUserId" SET NOT NULL;

-- Drop the old column
ALTER TABLE "Exhibition" DROP COLUMN "ownerProfileId";

-- CreateIndex
CREATE INDEX "Exhibition_curatorUserId_idx" ON "Exhibition"("curatorUserId");

-- AddForeignKey
ALTER TABLE "Exhibition" ADD CONSTRAINT "Exhibition_curatorUserId_fkey" FOREIGN KEY ("curatorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
