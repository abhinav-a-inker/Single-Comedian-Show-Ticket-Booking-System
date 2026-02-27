import prisma from "../utils/prisma";
import { subDays, format, startOfDay } from "date-fns";

export class OverviewService {
  /**
   * Returns all overview data for the dashboard.
   * @param loginId  - The requesting user's ID
   * @param role     - "ADMIN" sees all; "CLIENT" sees only their shows
   */
  async getOverview(loginId: string, role: "ADMIN" | "CLIENT" | "TICKET_VALIDATOR") {
    const showFilter = role === "ADMIN" ? {} : { loginId };

    // ── 1. Fetch shows in scope ─────────────────────────────────────────────
    const shows = await prisma.show.findMany({
      where: showFilter,
      select: {
        id: true,
        title: true,
        status: true,
        totalSeats: true,
        _count: { select: { bookings: true } },
      },
    });

    const showIds = shows.map((s) => s.id);

    // ── 2. Aggregate booking stats ──────────────────────────────────────────
    const bookings = await prisma.booking.findMany({
      where: { showId: { in: showIds } },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        quantity: true,
        createdAt: true,
        bookingRef: true,
        seats: { select: { pricePaid: true } },
        transaction: { select: { status: true } },
      },
    });

    const confirmedStatuses = ["CONFIRMED", "CHECKED_IN"];
    const activeShowStatuses = ["PUBLISHED", "BOOKING_ENABLED"];

    const totalRevenue = bookings
      .filter((b) => confirmedStatuses.includes(b.status))
      .reduce((sum, b) => sum + b.totalAmount, 0);

    const totalSeatsBooked = bookings
      .filter((b) => confirmedStatuses.includes(b.status))
      .reduce((sum, b) => sum + b.quantity, 0);

    const totalCapacity = shows.reduce((sum, s) => sum + s.totalSeats, 0);
    const avgOccupancy =
      totalCapacity > 0 ? Math.round((totalSeatsBooked / totalCapacity) * 100) : 0;

    // Booking status distribution
    const statusMap: Record<string, number> = {};
    for (const b of bookings) {
      statusMap[b.status] = (statusMap[b.status] ?? 0) + 1;
    }
    const bookingStatusDist = Object.entries(statusMap).map(([status, count]) => ({
      status,
      count,
    }));

    // Pending refunds
    const pendingRefunds = await prisma.cancellation.count({
      where: {
        refundStatus: "PENDING",
        booking: { showId: { in: showIds } },
      },
    });

    // ── 3. Revenue chart – last 30 days ─────────────────────────────────────
    const thirtyDaysAgo = subDays(new Date(), 29);
    const recentBookings = bookings.filter(
      (b) => new Date(b.createdAt) >= startOfDay(thirtyDaysAgo)
    );

    const dailyMap: Record<string, { revenue: number; bookings: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "dd MMM");
      dailyMap[d] = { revenue: 0, bookings: 0 };
    }
    for (const b of recentBookings) {
      const key = format(new Date(b.createdAt), "dd MMM");
      if (dailyMap[key]) {
        dailyMap[key].bookings += 1;
        if (confirmedStatuses.includes(b.status)) {
          dailyMap[key].revenue += b.totalAmount;
        }
      }
    }
    const revenueChart = Object.entries(dailyMap).map(([date, v]) => ({
      date,
      ...v,
    }));

    // ── 4. Top 5 shows by revenue ────────────────────────────────────────────
    const showRevenueMap: Record<string, { revenue: number; booked: number; capacity: number; title: string }> = {};
    for (const s of shows) {
      showRevenueMap[s.id] = { revenue: 0, booked: 0, capacity: s.totalSeats, title: s.title };
    }
    for (const b of bookings) {
      if (showRevenueMap[b.showId ?? ""] && confirmedStatuses.includes(b.status)) {
        showRevenueMap[b.showId].revenue += b.totalAmount;
        showRevenueMap[b.showId].booked += b.quantity;
      }
    }
    const topShows = Object.values(showRevenueMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((s) => ({
        title: s.title.length > 20 ? s.title.slice(0, 18) + "…" : s.title,
        booked: s.booked,
        capacity: s.capacity,
        revenue: s.revenue,
      }));

    // ── 5. Recent logs (last 20) ─────────────────────────────────────────────
    const logFilter =
      role === "ADMIN"
        ? {}
        : { booking: { showId: { in: showIds } } };

    const logs = await prisma.bookingLog.findMany({
      where: logFilter,
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        action: true,
        description: true,
        createdAt: true,
        booking: { select: { bookingRef: true } },
      },
    });

    const recentLogs = logs.map((l) => ({
      id: l.id,
      action: l.action,
      description: l.description,
      createdAt: l.createdAt,
      bookingRef: l.booking?.bookingRef ?? null,
    }));

    // ── 6. Compose response ──────────────────────────────────────────────────
    return {
      stats: {
        totalShows: shows.length,
        activeShows: shows.filter((s) => activeShowStatuses.includes(s.status)).length,
        totalBookings: bookings.length,
        confirmedBookings: bookings.filter((b) => confirmedStatuses.includes(b.status)).length,
        totalRevenue: Math.round(totalRevenue),
        pendingRefunds,
        totalSeatsBooked,
        avgOccupancy,
      },
      revenueChart,
      bookingStatusDist,
      topShows,
      recentLogs,
    };
  }
}