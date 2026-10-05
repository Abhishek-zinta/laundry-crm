-- CreateTable
CREATE TABLE "MobileSession" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "revokedReason" TEXT,
    "replacedById" UUID,
    "deviceName" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "lastUsedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MobileSession_refreshTokenHash_key" ON "MobileSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "MobileSession_userId_idx" ON "MobileSession"("userId");

-- CreateIndex
CREATE INDEX "MobileSession_familyId_idx" ON "MobileSession"("familyId");

-- AddForeignKey
ALTER TABLE "MobileSession" ADD CONSTRAINT "MobileSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileSession" ADD CONSTRAINT "MobileSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
