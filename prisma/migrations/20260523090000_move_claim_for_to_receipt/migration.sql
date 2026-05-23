-- Move claimFor/claimForChildNo from Claim to Receipt

-- Add to Receipt
ALTER TABLE "Receipt" ADD COLUMN "claimFor" "ClaimFor" NOT NULL DEFAULT 'SELF';
ALTER TABLE "Receipt" ADD COLUMN "claimForChildNo" INTEGER;

-- Drop from Claim
ALTER TABLE "Claim" DROP COLUMN "claimFor";
ALTER TABLE "Claim" DROP COLUMN "claimForChildNo";
