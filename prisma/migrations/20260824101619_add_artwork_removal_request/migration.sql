-- CreateEnum
CREATE TYPE "RemovalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ArtworkRemovalRequest" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "exhibitionId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "RemovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "responseMessage" TEXT,
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "ArtworkRemovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArtworkRemovalRequest_exhibitionId_status_idx" ON "ArtworkRemovalRequest"("exhibitionId", "status");

-- CreateIndex
CREATE INDEX "ArtworkRemovalRequest_artworkId_status_idx" ON "ArtworkRemovalRequest"("artworkId", "status");

-- AddForeignKey
ALTER TABLE "ArtworkRemovalRequest" ADD CONSTRAINT "ArtworkRemovalRequest_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkRemovalRequest" ADD CONSTRAINT "ArtworkRemovalRequest_exhibitionId_fkey" FOREIGN KEY ("exhibitionId") REFERENCES "Exhibition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkRemovalRequest" ADD CONSTRAINT "ArtworkRemovalRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkRemovalRequest" ADD CONSTRAINT "ArtworkRemovalRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
