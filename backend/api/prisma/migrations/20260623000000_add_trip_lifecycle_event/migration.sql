-- CreateEnum
CREATE TYPE "TripLifecycleAction" AS ENUM ('AUTO_ABORTED', 'FORCE_ABORTED', 'FORCE_COMPLETED', 'ACKNOWLEDGED');

-- CreateTable
CREATE TABLE "TripLifecycleEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "action" "TripLifecycleAction" NOT NULL,
    "actor" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripLifecycleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TripLifecycleEvent_tenantId_createdAt_idx" ON "TripLifecycleEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "TripLifecycleEvent_tripId_idx" ON "TripLifecycleEvent"("tripId");

-- AddForeignKey
ALTER TABLE "TripLifecycleEvent" ADD CONSTRAINT "TripLifecycleEvent_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
