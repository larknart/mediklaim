-- CreateEnum
CREATE TYPE "ClaimFor" AS ENUM ('SELF', 'SPOUSE', 'CHILD');

-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "claimFor" "ClaimFor" NOT NULL DEFAULT 'SELF',
ADD COLUMN     "claimForChildNo" INTEGER;
