-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'TEACHER';

-- AlterTable
ALTER TABLE "Route" ADD COLUMN     "vehicleId" TEXT;

-- CreateTable
CREATE TABLE "RouteStaff" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteStaff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RouteStaff_tenantId_idx" ON "RouteStaff"("tenantId");

-- CreateIndex
CREATE INDEX "RouteStaff_membershipId_idx" ON "RouteStaff"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "RouteStaff_routeId_membershipId_key" ON "RouteStaff"("routeId", "membershipId");

-- CreateIndex
CREATE INDEX "Route_vehicleId_idx" ON "Route"("vehicleId");

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStaff" ADD CONSTRAINT "RouteStaff_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStaff" ADD CONSTRAINT "RouteStaff_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
