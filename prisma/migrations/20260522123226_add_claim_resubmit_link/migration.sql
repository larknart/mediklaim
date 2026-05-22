-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "resubmittedFromId" TEXT;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_resubmittedFromId_fkey" FOREIGN KEY ("resubmittedFromId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;
