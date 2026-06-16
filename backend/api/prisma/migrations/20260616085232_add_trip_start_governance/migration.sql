-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "scheduledStart" TIMESTAMP(3);

-- Backfill existing trips: planned departure defaults to the trip date.
UPDATE "Trip" SET "scheduledStart" = "date" WHERE "scheduledStart" IS NULL;

-- CreateTable
CREATE TABLE "TripStartException" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "deltaMinutes" INTEGER NOT NULL,
    "dailyCheckDone" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripStartException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TripStartException_tenantId_resolvedAt_idx" ON "TripStartException"("tenantId", "resolvedAt");

-- CreateIndex
CREATE INDEX "TripStartException_tripId_idx" ON "TripStartException"("tripId");

-- AddForeignKey
ALTER TABLE "TripStartException" ADD CONSTRAINT "TripStartException_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
