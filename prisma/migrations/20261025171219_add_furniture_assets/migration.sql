-- CreateTable
CREATE TABLE "FurnitureAsset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "modelUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "nativeWidth" DOUBLE PRECISION NOT NULL,
    "nativeDepth" DOUBLE PRECISION NOT NULL,
    "scale" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FurnitureAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FurnitureAsset_organizationId_idx" ON "FurnitureAsset"("organizationId");

-- AddForeignKey
ALTER TABLE "FurnitureAsset" ADD CONSTRAINT "FurnitureAsset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
