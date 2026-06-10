-- AlterTable
ALTER TABLE "Approval" ADD COLUMN     "actorEmail" TEXT,
ADD COLUMN     "actorName" TEXT;

-- AlterTable
ALTER TABLE "ClaimComment" ADD COLUMN     "authorName" TEXT;

-- Backfill: snapshot existing actor/author names from User table
UPDATE "Approval" a
SET "actorName" = u.name,
    "actorEmail" = u.email
FROM "User" u
WHERE a."actorId" = u.id
  AND a."actorName" IS NULL;

UPDATE "ClaimComment" cc
SET "authorName" = u.name
FROM "User" u
WHERE cc."authorId" = u.id
  AND cc."authorName" IS NULL;
