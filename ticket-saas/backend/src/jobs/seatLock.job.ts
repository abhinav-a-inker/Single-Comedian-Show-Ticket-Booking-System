import prisma from "../utils/prisma";

export const releaseExpiredSeats = async () => {
  try {
    const now = new Date();

    const expiredSeats = await prisma.seat.findMany({
      where: {
        status: "LOCKED",
        lockedUntil: { lt: now },
      },
    });

    if (expiredSeats.length === 0) return;

    console.log(`[CronJob] Releasing ${expiredSeats.length} expired seats`);

    await prisma.seat.updateMany({
      where: { id: { in: expiredSeats.map((s) => s.id) } },
      data: { status: "AVAILABLE", lockedUntil: null },
    });

    await prisma.booking.updateMany({
      where: {
        status: "SEATS_SELECTED",
        seats: { some: { seatId: { in: expiredSeats.map((s) => s.id) } } },
      },
      data: { status: "EXPIRED" },
    });

  } catch (error: any) {
    // Log the error but don't crash — the job will retry on next interval
    if (error.code === "P1001") {
      console.error("[CronJob] Database unreachable — will retry next interval");
    } else {
      console.error("[CronJob] Unexpected error in releaseExpiredSeats:", error.message);
    }
  }
};