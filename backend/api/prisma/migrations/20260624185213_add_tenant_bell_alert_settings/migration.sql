-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "alertNumbers" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "bellTimings" JSONB NOT NULL DEFAULT '[]';
