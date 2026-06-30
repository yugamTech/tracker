-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "schoolLat" DOUBLE PRECISION,
ADD COLUMN     "schoolLng" DOUBLE PRECISION,
ADD COLUMN     "schoolName" TEXT;

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "anchorLabel" TEXT,
ADD COLUMN     "anchorLat" DOUBLE PRECISION,
ADD COLUMN     "anchorLng" DOUBLE PRECISION,
ADD COLUMN     "shiftId" TEXT;

-- CreateIndex
CREATE INDEX "AgeGroup_tenantId_idx" ON "AgeGroup"("tenantId");

-- CreateIndex
CREATE INDEX "Trip_shiftId_idx" ON "Trip"("shiftId");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "AgeGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

