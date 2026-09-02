-- AlterTable
ALTER TABLE "Exhibition" ADD COLUMN     "artistProfileId" TEXT;

-- CreateIndex
CREATE INDEX "Exhibition_artistProfileId_idx" ON "Exhibition"("artistProfileId");

-- AddForeignKey
ALTER TABLE "Exhibition" ADD CONSTRAINT "Exhibition_artistProfileId_fkey" FOREIGN KEY ("artistProfileId") REFERENCES "ArtistProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
