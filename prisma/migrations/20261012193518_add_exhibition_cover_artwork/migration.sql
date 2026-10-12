-- AlterTable
ALTER TABLE "Exhibition" ADD COLUMN     "coverArtworkId" TEXT;

-- CreateIndex
CREATE INDEX "Exhibition_coverArtworkId_idx" ON "Exhibition"("coverArtworkId");

-- AddForeignKey
ALTER TABLE "Exhibition" ADD CONSTRAINT "Exhibition_coverArtworkId_fkey" FOREIGN KEY ("coverArtworkId") REFERENCES "Artwork"("id") ON DELETE SET NULL ON UPDATE CASCADE;
