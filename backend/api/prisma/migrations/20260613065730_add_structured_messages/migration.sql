-- CreateEnum
CREATE TYPE "MessageKey" AS ENUM ('RUNNING_LATE', 'NOT_COMING_TODAY', 'PLEASE_WAIT', 'DIFFERENT_STOP');

-- CreateTable
CREATE TABLE "StructuredMessage" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "messageKey" "MessageKey" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "StructuredMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StructuredMessage_tripId_sentAt_idx" ON "StructuredMessage"("tripId", "sentAt");

-- AddForeignKey
ALTER TABLE "StructuredMessage" ADD CONSTRAINT "StructuredMessage_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructuredMessage" ADD CONSTRAINT "StructuredMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
