-- AlterEnum
ALTER TYPE "LoanStatus" ADD VALUE 'NULLIFIED';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "isVoided" BOOLEAN NOT NULL DEFAULT false;
