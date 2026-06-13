-- CreateTable
CREATE TABLE "DailyCheck" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tripId" TEXT,
    "vehicleId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyCheck_tenantId_createdAt_idx" ON "DailyCheck"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "DailyCheck_vehicleId_createdAt_idx" ON "DailyCheck"("vehicleId", "createdAt");
