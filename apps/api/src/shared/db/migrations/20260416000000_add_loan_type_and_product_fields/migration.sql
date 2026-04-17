-- CreateEnum
CREATE TYPE "LoanType" AS ENUM ('CASH', 'PRODUCT');

-- AlterTable
ALTER TABLE "loans"
  ADD COLUMN "type" "LoanType" NOT NULL DEFAULT 'CASH',
  ADD COLUMN "productName" TEXT,
  ADD COLUMN "productDescription" TEXT;
