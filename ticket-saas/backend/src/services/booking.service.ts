import prisma from "../utils/prisma";

// ─── DEBUG — hit GET /api/bookings/debug to see what's in your DB ────────────
export const debugBookingsService = async (loginId: string, role: string) => {
  const allBookings = await prisma.booking.findMany({
    where: { show: role === "ADMIN" ? {} : { loginId } },
    select: { id: true, bookingRef: true, status: true, showId: true, bookerName: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const counts = await prisma.booking.groupBy({
    by: ["status"],
    where: { show: role === "ADMIN" ? {} : { loginId } },
    _count: { id: true },
  });
  const showCount = await prisma.show.count({
    where: role === "ADMIN" ? {} : { loginId },
  });
  return { showCount, statusCounts: counts, recentBookings: allBookings };
};

// ─── Shows list for dropdown ──────────────────────────────────────────────────
export const getShowsListService = async (loginId: string, role: string) => {
  return await prisma.show.findMany({
    where: role === "ADMIN" ? {} : { loginId },
    select: { id: true, title: true, date: true, city: true },
    orderBy: { date: "desc" },
  });
};

// ─── Bookings (all statuses), optionally filtered by showId ──────────
export const getBookingsService = async (
  loginId: string,
  role: string,
  showId?: string
) => {
  return await prisma.booking.findMany({
    where: {
      show:    role === "ADMIN" ? {} : { loginId },
      ...(showId ? { showId } : {}),
    },
    include: {
      show: {
        select: { id: true, title: true, date: true, time: true, venue: true, city: true },
      },
      seats: {
        include: {
          seat:     { select: { seatCode: true, rowLabel: true } },
          category: { select: { name: true, color: true, price: true } },
        },
      },
      transaction:  true,
      cancellation: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

// ─── Stats for one show ───────────────────────────────────────────────────────
export const getShowStatsService = async (
  showId: string,
  loginId: string,
  role: string
) => {
  const show = await prisma.show.findFirst({
    where: role === "ADMIN" ? { id: showId } : { id: showId, loginId },
  });
  if (!show) throw new Error("Show not found");

  const [confirmed, cancelled, pending, total, revenueAgg, refundAgg] = await Promise.all([
    prisma.booking.count({ where: { showId, status: "CONFIRMED" } }),
    prisma.booking.count({ where: { showId, status: "CANCELLED" } }),
    prisma.booking.count({ where: { showId, status: { in: ["PENDING", "SEATS_SELECTED"] } } }),
    prisma.booking.count({ where: { showId } }),
    prisma.transaction.aggregate({
      where: { booking: { showId }, status: "PAID" },
      _sum: { amount: true },
    }),
    prisma.cancellation.aggregate({
      where: { booking: { showId } },
      _sum: { refundAmount: true },
    }),
  ]);

  const totalRevenue  = revenueAgg._sum.amount       ?? 0;
  const totalRefunded = refundAgg._sum.refundAmount   ?? 0;

  return {
    confirmedBookings: confirmed,
    cancelledBookings: cancelled,
    pendingBookings: pending,
    totalBookings: total,
    totalRevenue,
    totalRefunded,
    netRevenue: totalRevenue - totalRefunded,
  };
};