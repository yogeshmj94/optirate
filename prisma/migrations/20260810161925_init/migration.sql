-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'RISK_EVALUATED', 'AUCTION_OPEN', 'AUCTION_CLOSED', 'FUNDED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('ACTIVE', 'WITHDRAWN', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "Borrower" (
    "id" TEXT NOT NULL,
    "aaConsentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Borrower_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanApplication" (
    "id" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "requestedAmount" DECIMAL(65,30) NOT NULL,
    "requestedTenureMonths" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionWindowStart" TIMESTAMP(3) NOT NULL,
    "transactionWindowEnd" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskDecisionAuditRecord" (
    "id" TEXT NOT NULL,
    "loanApplicationId" TEXT NOT NULL,
    "rulesVersion" TEXT NOT NULL,
    "sriScore" INTEGER NOT NULL,
    "sriAction" TEXT NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "flagDetails" JSONB NOT NULL,

    CONSTRAINT "RiskDecisionAuditRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionBid" (
    "id" TEXT NOT NULL,
    "loanApplicationId" TEXT NOT NULL,
    "lenderId" TEXT NOT NULL,
    "interestRateOffered" DECIMAL(65,30) NOT NULL,
    "bidReasoning" JSONB NOT NULL,
    "bidStatus" "BidStatus" NOT NULL DEFAULT 'ACTIVE',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionBid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionResult" (
    "id" TEXT NOT NULL,
    "loanApplicationId" TEXT NOT NULL,
    "winningBidId" TEXT NOT NULL,
    "finalRate" DECIMAL(65,30) NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "selectionReasoning" TEXT NOT NULL,

    CONSTRAINT "AuctionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformLedgerEntry" (
    "id" TEXT NOT NULL,
    "loanApplicationId" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "direction" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanOutcomeSync" (
    "id" TEXT NOT NULL,
    "loanApplicationId" TEXT NOT NULL,
    "syncedStatus" TEXT NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanOutcomeSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RiskDecisionAuditRecord_loanApplicationId_key" ON "RiskDecisionAuditRecord"("loanApplicationId");

-- CreateIndex
CREATE INDEX "AuctionBid_loanApplicationId_idx" ON "AuctionBid"("loanApplicationId");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionResult_loanApplicationId_key" ON "AuctionResult"("loanApplicationId");

-- AddForeignKey
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "Borrower"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskDecisionAuditRecord" ADD CONSTRAINT "RiskDecisionAuditRecord_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "LoanApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionBid" ADD CONSTRAINT "AuctionBid_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "LoanApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionResult" ADD CONSTRAINT "AuctionResult_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "LoanApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformLedgerEntry" ADD CONSTRAINT "PlatformLedgerEntry_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "LoanApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanOutcomeSync" ADD CONSTRAINT "LoanOutcomeSync_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "LoanApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
