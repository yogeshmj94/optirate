import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.ts';

export type RiskDecisionRecord = Prisma.RiskDecisionAuditRecordGetPayload<{}>;

export interface CreateRiskDecisionInput {
  loanApplicationId: string;
  rulesVersion: string;
  sriScore: number;
  sriAction: string;
  flagDetails: Prisma.InputJsonValue;
}

// Append-only by design: audit integrity must survive regulatory review, so no update/delete API exists here.
export function createRiskDecision(input: CreateRiskDecisionInput): Promise<RiskDecisionRecord> {
  return prisma.riskDecisionAuditRecord.create({ data: input });
}

export function getRiskDecisionByApplicationId(loanApplicationId: string): Promise<RiskDecisionRecord | null> {
  return prisma.riskDecisionAuditRecord.findUnique({ where: { loanApplicationId } });
}
