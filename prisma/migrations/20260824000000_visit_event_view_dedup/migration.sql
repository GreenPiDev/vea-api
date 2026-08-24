-- Dedup existing rows before enforcing uniqueness: keep the earliest
-- VisitEvent per (artworkId, sessionId, eventType), drop the rest.
-- artworkId is nullable (EXHIBITION_ENTER has no artworkId); Postgres treats
-- NULL as distinct in unique constraints, so those rows are unaffected here
-- and won't collide once the constraint is added below.
DELETE FROM "VisitEvent" v
USING "VisitEvent" v2
WHERE v."artworkId" IS NOT NULL
  AND v."artworkId" = v2."artworkId"
  AND v."sessionId" = v2."sessionId"
  AND v."eventType" = v2."eventType"
  AND (v."occurredAt", v.id) > (v2."occurredAt", v2.id);

-- CreateIndex
CREATE UNIQUE INDEX "VisitEvent_artworkId_sessionId_eventType_key" ON "VisitEvent"("artworkId", "sessionId", "eventType");
