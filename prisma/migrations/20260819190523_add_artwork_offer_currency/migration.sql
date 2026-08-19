/*
  Warnings:

  - Added the required column `currency` to the `Artwork` table without a default value. This is not possible if the table is not empty.
  - Added the required column `currency` to the `Offer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Artwork" ADD COLUMN     "currency" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "currency" TEXT NOT NULL;
