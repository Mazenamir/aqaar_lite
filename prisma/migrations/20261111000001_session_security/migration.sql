-- AlterTable
ALTER TABLE "sessions" ADD COLUMN "sessionTokenHash" TEXT NOT NULL,
ADD COLUMN "revokedAt" TIMESTAMP(3),
ADD COLUMN "ipAddress" TEXT,
ADD COLUMN "userAgent" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionTokenHash_key" ON "sessions"("sessionTokenHash");

-- CreateIndex
CREATE INDEX "sessions_sessionTokenHash_idx" ON "sessions"("sessionTokenHash");
