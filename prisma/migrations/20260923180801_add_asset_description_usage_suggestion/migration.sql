/*
  Warnings:

  - You are about to drop the column `colors` on the `Brand` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "description" TEXT,
ADD COLUMN     "usageSuggestion" TEXT;

-- AlterTable
ALTER TABLE "Brand" DROP COLUMN "colors";
