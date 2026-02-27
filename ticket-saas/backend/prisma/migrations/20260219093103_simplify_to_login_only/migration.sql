-- Add TICKET_VALIDATOR to Role enum
ALTER TYPE "Role" ADD VALUE 'TICKET_VALIDATOR';

-- Drop old foreign keys first
ALTER TABLE "Client" DROP CONSTRAINT "Client_loginId_fkey";
ALTER TABLE "Show" DROP CONSTRAINT "Show_clientId_fkey";

-- Add name to Login WITH a default so existing rows don't break
ALTER TABLE "Login" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'User';

-- Add loginId to Show WITH empty default temporarily
ALTER TABLE "Show" ADD COLUMN "loginId" TEXT NOT NULL DEFAULT '';

-- Point all existing shows to the CLIENT login
UPDATE "Show" SET "loginId" = (
  SELECT id FROM "Login" WHERE role = 'CLIENT' LIMIT 1
);

-- Remove the temporary default
ALTER TABLE "Show" ALTER COLUMN "loginId" DROP DEFAULT;

-- Drop old clientId column
ALTER TABLE "Show" DROP COLUMN "clientId";

-- Drop Client table
DROP TABLE "Client";

-- Drop ClientStatus enum
DROP TYPE "ClientStatus";

-- Add foreign key for loginId
ALTER TABLE "Show" ADD CONSTRAINT "Show_loginId_fkey" 
  FOREIGN KEY ("loginId") REFERENCES "Login"("id") 
  ON DELETE RESTRICT ON UPDATE CASCADE;