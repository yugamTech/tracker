-- AlterTable
ALTER TABLE "DailyCheck" ADD COLUMN     "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
