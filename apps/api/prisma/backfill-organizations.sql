-- Backfill: Organization + Tournament.organizationId
-- Idempotente a propósito — se puede re-ejecutar si db push se queda a medias.

DO $$ BEGIN
  CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Organization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "brandColor" TEXT,
    "description" TEXT,
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Organization_slug_key" ON "Organization"("slug");

CREATE TABLE IF NOT EXISTS "OrganizationMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationMember_userId_organizationId_key"
  ON "OrganizationMember"("userId", "organizationId");
CREATE INDEX IF NOT EXISTS "OrganizationMember_organizationId_idx"
  ON "OrganizationMember"("organizationId");

DO $$ BEGIN
  ALTER TABLE "OrganizationMember"
    ADD CONSTRAINT "OrganizationMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrganizationMember"
    ADD CONSTRAINT "OrganizationMember_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

INSERT INTO "Organization" ("id", "slug", "name", "city", "brandColor", "description", "createdAt", "updatedAt")
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'parches-demo',
  'Parches Demo',
  'Bogotá',
  '#00e5ff',
  'Empresa de prueba. Dueña de los torneos seed.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;

UPDATE "Tournament"
SET "organizationId" = (SELECT "id" FROM "Organization" WHERE "slug" = 'parches-demo')
WHERE "organizationId" IS NULL;

ALTER TABLE "Tournament" ALTER COLUMN "organizationId" SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE "Tournament"
    ADD CONSTRAINT "Tournament_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Tournament_organizationId_idx" ON "Tournament"("organizationId");
