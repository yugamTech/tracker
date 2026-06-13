-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "conductorId" TEXT,
ADD COLUMN     "driverId" TEXT;

-- CreateIndex
CREATE INDEX "Trip_driverId_idx" ON "Trip"("driverId");

-- CreateIndex
CREATE INDEX "Trip_conductorId_idx" ON "Trip"("conductorId");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_conductorId_fkey" FOREIGN KEY ("conductorId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
