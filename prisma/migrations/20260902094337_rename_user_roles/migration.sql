-- Rename UserRole.ARTIST -> SELLER, UserRole.ADMIN -> GALLERY_ADMIN, and
-- drop the unused INSTITUTION value. Recreates the enum type (Postgres has
-- no DROP VALUE) and remaps existing "User"."role" rows via USING/CASE so
-- no data is lost for the two renamed values. Any INSTITUTION rows must be
-- removed before this runs (see vea-api/CLAUDE.md's role-rename note) --
-- the CASE has no INSTITUTION branch, so a leftover row would fail the cast.

ALTER TYPE "UserRole" RENAME TO "UserRole_old";

CREATE TYPE "UserRole" AS ENUM ('VISITOR', 'SELLER', 'GALLERY_ADMIN', 'SUPERADMIN');

ALTER TABLE "User"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "UserRole" USING (
    CASE "role"::text
      WHEN 'ARTIST' THEN 'SELLER'
      WHEN 'ADMIN' THEN 'GALLERY_ADMIN'
      ELSE "role"::text
    END
  )::"UserRole",
  ALTER COLUMN "role" SET DEFAULT 'VISITOR';

DROP TYPE "UserRole_old";
