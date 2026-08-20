/*
  Warnings:

  - A unique constraint covering the columns `[completionRequestId]` on the table `LoanApplication` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "LoanApplication" ADD COLUMN     "completionRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "LoanApplication_completionRequestId_key" ON "LoanApplication"("completionRequestId");
