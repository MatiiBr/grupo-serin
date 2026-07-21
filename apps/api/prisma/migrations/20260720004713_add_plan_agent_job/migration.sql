-- CreateEnum
CREATE TYPE "PlanAgentJobStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "PlanAgentJob" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "status" "PlanAgentJobStatus" NOT NULL DEFAULT 'RUNNING',
    "result" JSONB,
    "error" TEXT,
    "errorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanAgentJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanAgentJob_operationId_idx" ON "PlanAgentJob"("operationId");

-- CreateIndex
CREATE INDEX "PlanAgentJob_status_idx" ON "PlanAgentJob"("status");
