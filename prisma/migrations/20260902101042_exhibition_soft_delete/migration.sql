-- Soft-delete support for Exhibition: null = visible, non-null = removed
-- (kept for historical VisitEvent/Offer/stats data, see the schema.prisma
-- field comment).
ALTER TABLE "Exhibition" ADD COLUMN "deletedAt" TIMESTAMP(3);
