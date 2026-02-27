-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ShowStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SeatArrangementType" AS ENUM ('FRONT_TO_BACK', 'BACK_TO_FRONT', 'EQUAL');

-- CreateEnum
CREATE TYPE "SeatStatus" AS ENUM ('AVAILABLE', 'LOCKED', 'BOOKED', 'BLOCKED');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "status" "ClientStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "Show" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "venue" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "posterImage" TEXT,
    "qrCode" TEXT,
    "whatsappKeyword" TEXT NOT NULL,
    "status" "ShowStatus" NOT NULL DEFAULT 'DRAFT',
    "cancellationAllowed" BOOLEAN NOT NULL DEFAULT true,
    "refundSlabs" JSONB,
    "totalRows" INTEGER NOT NULL,
    "totalCols" INTEGER NOT NULL,
    "totalSeats" INTEGER NOT NULL,
    "arrangementType" "SeatArrangementType" NOT NULL DEFAULT 'FRONT_TO_BACK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Show_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatCategory" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "earlyBirdPrice" DOUBLE PRECISION,
    "earlyBirdDeadline" TIMESTAMP(3),
    "fromRow" TEXT NOT NULL,
    "toRow" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeatCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seat" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "rowLabel" TEXT NOT NULL,
    "seatNumber" INTEGER NOT NULL,
    "seatCode" TEXT NOT NULL,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "status" "SeatStatus" NOT NULL DEFAULT 'AVAILABLE',
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Show_whatsappKeyword_key" ON "Show"("whatsappKeyword");

-- CreateIndex
CREATE UNIQUE INDEX "Seat_showId_seatCode_key" ON "Seat"("showId", "seatCode");

-- AddForeignKey
ALTER TABLE "Show" ADD CONSTRAINT "Show_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatCategory" ADD CONSTRAINT "SeatCategory_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SeatCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
