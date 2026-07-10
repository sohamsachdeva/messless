/*
  Warnings:

  - A unique constraint covering the columns `[owner_id]` on the table `vendors` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "OTPType" AS ENUM ('EMAIL_VERIFY', 'PHONE_VERIFY', 'PASSWORD_RESET');

-- DropIndex
DROP INDEX "vendors_owner_id_idx";

-- CreateTable
CREATE TABLE "otps" (
    "id" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "OTPType" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "otps_target_type_idx" ON "otps"("target", "type");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_owner_id_key" ON "vendors"("owner_id");
