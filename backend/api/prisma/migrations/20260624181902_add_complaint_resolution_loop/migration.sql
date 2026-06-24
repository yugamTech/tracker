/*
  Warnings:

  - Added the required column `ratedBy` to the `ResolutionRating` table without a default value. This is not possible if the table is not empty.
  - Added the required column `satisfied` to the `ResolutionRating` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ResolutionRating" ADD COLUMN     "ratedBy" TEXT NOT NULL,
ADD COLUMN     "satisfied" BOOLEAN NOT NULL;

-- CreateIndex
CREATE INDEX "Complaint_raisedBy_idx" ON "Complaint"("raisedBy");

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_raisedBy_fkey" FOREIGN KEY ("raisedBy") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
