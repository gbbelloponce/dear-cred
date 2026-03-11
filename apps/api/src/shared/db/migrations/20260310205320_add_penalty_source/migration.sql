-- AlterTable
ALTER TABLE "installments" ADD COLUMN     "penaltySourceId" TEXT;

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_penaltySourceId_fkey" FOREIGN KEY ("penaltySourceId") REFERENCES "installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
