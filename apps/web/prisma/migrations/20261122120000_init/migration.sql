-- CreateEnum
CREATE TYPE "PreferredLocale" AS ENUM ('en', 'ar');
CREATE TYPE "IdentitySource" AS ENUM ('USER', 'AUTO');
CREATE TYPE "FaceSide" AS ENUM ('FRONT', 'BACK');
CREATE TYPE "FaceStatus" AS ENUM ('OK', 'LOW_CONFIDENCE', 'UNSUPPORTED', 'MANUAL');
CREATE TYPE "CaptureSource" AS ENUM ('CAMERA', 'UPLOAD', 'SCANNER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "preferredLocale" "PreferredLocale" NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Scan" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT,
    "algorithmVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cardId" TEXT,
    "setId" TEXT,
    "setName" TEXT,
    "number" TEXT,
    "name" TEXT,
    "imageUrl" TEXT,
    "identitySource" "IdentitySource" NOT NULL DEFAULT 'USER',
    "identityConfidence" DOUBLE PRECISION,
    "candidatesJson" JSONB,
    CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScanFace" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "face" "FaceSide" NOT NULL,
    "status" "FaceStatus" NOT NULL,
    "borderL" DOUBLE PRECISION NOT NULL,
    "borderR" DOUBLE PRECISION NOT NULL,
    "borderT" DOUBLE PRECISION NOT NULL,
    "borderB" DOUBLE PRECISION NOT NULL,
    "lrRatio" DOUBLE PRECISION NOT NULL,
    "tbRatio" DOUBLE PRECISION NOT NULL,
    "uncertaintyLr" DOUBLE PRECISION NOT NULL,
    "uncertaintyTb" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "printSkewDeg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "framesUsed" INTEGER NOT NULL DEFAULT 1,
    "captureSource" "CaptureSource" NOT NULL,
    "qualityJson" JSONB,
    "linesJson" JSONB,
    "manualAdjusted" BOOLEAN NOT NULL DEFAULT false,
    "thumbnailRef" TEXT,
    CONSTRAINT "ScanFace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ListingAttachment" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "externalListingId" TEXT NOT NULL,
    "target" TEXT NOT NULL DEFAULT 'setline',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListingAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "ScanFace_scanId_face_key" ON "ScanFace"("scanId", "face");
CREATE UNIQUE INDEX "ShareLink_slug_key" ON "ShareLink"("slug");

ALTER TABLE "Scan" ADD CONSTRAINT "Scan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScanFace" ADD CONSTRAINT "ScanFace_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingAttachment" ADD CONSTRAINT "ListingAttachment_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;