-- AlterTable: replace flat roomWidth/roomDepth with a discriminated
-- roomShape Json column (rectangle | custom), same spirit as
-- Exhibition.sceneConfig. Existing rows are backfilled as {kind:'rectangle',
-- width, depth} from their old flat values before those columns are dropped,
-- so no data is lost.
ALTER TABLE "ExhibitionTemplate" ADD COLUMN "roomShape" JSONB;

UPDATE "ExhibitionTemplate"
SET "roomShape" = jsonb_build_object('kind', 'rectangle', 'width', "roomWidth", 'depth', "roomDepth");

ALTER TABLE "ExhibitionTemplate" ALTER COLUMN "roomShape" SET NOT NULL;

ALTER TABLE "ExhibitionTemplate" DROP COLUMN "roomWidth";
ALTER TABLE "ExhibitionTemplate" DROP COLUMN "roomDepth";
