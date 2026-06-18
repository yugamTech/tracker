-- CreateTable
CREATE TABLE "TripCompletionException" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "stoppedAtSeq" INTEGER NOT NULL,
    "totalStops" INTEGER NOT NULL,
    "boarded" INTEGER NOT NULL,
    "totalRiders" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripCompletionException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TripCompletionException_tenantId_resolvedAt_idx" ON "TripCompletionException"("tenantId", "resolvedAt");

-- CreateIndex
CREATE INDEX "TripCompletionException_tripId_idx" ON "TripCompletionException"("tripId");

-- AddForeignKey
ALTER TABLE "TripCompletionException" ADD CONSTRAINT "TripCompletionException_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
