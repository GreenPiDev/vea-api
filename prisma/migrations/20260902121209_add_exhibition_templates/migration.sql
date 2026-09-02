-- AlterTable
ALTER TABLE "Exhibition" ADD COLUMN     "exhibitionTemplateId" TEXT;

-- CreateTable
CREATE TABLE "ExhibitionTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subtitle" TEXT,
    "roomWidth" DOUBLE PRECISION NOT NULL,
    "roomDepth" DOUBLE PRECISION NOT NULL,
    "wallHeight" DOUBLE PRECISION NOT NULL,
    "wallColor" TEXT NOT NULL,
    "floorColor" TEXT NOT NULL,
    "ceilingColor" TEXT NOT NULL,
    "floorTextureId" TEXT,
    "wallTextureId" TEXT,
    "ceilingTextureId" TEXT,
    "theme" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExhibitionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExhibitionTemplate_organizationId_idx" ON "ExhibitionTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "Exhibition_exhibitionTemplateId_idx" ON "Exhibition"("exhibitionTemplateId");

-- AddForeignKey
ALTER TABLE "Exhibition" ADD CONSTRAINT "Exhibition_exhibitionTemplateId_fkey" FOREIGN KEY ("exhibitionTemplateId") REFERENCES "ExhibitionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExhibitionTemplate" ADD CONSTRAINT "ExhibitionTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
