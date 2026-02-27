import prisma from "../utils/prisma";

// ─── Shows list for dropdown ──────────────────────────────────────────────────
export const getRevenueShowsService = async (loginId: string, role: string) => {
  return prisma.show.findMany({
    where: role === "ADMIN" ? {} : { loginId },
    select: { id: true, title: true, date: true, city: true, status: true },
    orderBy: { date: "desc" },
  });
};

// ─── Global summary KPIs (all shows or one show) ─────────────────────────────
export const getRevenueSummaryService = async (
  loginId: string,
  role: string,
  showId?: string
) => {
  const showFilter = role === "ADMIN" ? {} : { loginId };
  const bookingWhere = {
    show: showId ? { id: showId, ...showFilter } : showFilter,
  };

  const [
    grossAgg,
    refundAgg,
    confirmedCount,
    cancelledCount,
    cashAgg,
    razorpayAgg,
    freeAgg,
    totalSeatsAgg,
    bookedSeatsAgg,
  ] = await Promise.all([
    prisma.transaction.aggregate({
      where: { status: "PAID", booking: bookingWhere },
      _sum: { amount: true },
    }),
    prisma.cancellation.aggregate({
      where: { booking: { ...bookingWhere, status: "CANCELLED" } },
      _sum: { refundAmount: true },
    }),
    prisma.booking.count({ where: { ...bookingWhere, status: "CONFIRMED" } }),
    prisma.booking.count({ where: { ...bookingWhere, status: "CANCELLED" } }),
    prisma.transaction.aggregate({
      where: { status: "PAID", gateway: "CASH",     booking: bookingWhere },
      _sum:  { amount: true }, _count: { id: true },
    }),
    prisma.transaction.aggregate({
      where: { status: "PAID", gateway: "RAZORPAY", booking: bookingWhere },
      _sum:  { amount: true }, _count: { id: true },
    }),
    prisma.transaction.aggregate({
      where: { status: "PAID", gateway: "FREE",     booking: bookingWhere },
      _sum:  { amount: true }, _count: { id: true },
    }),
    // total potential seats for this scope
    prisma.show.aggregate({
      where: showId ? { id: showId, ...showFilter } : showFilter,
      _sum: { totalSeats: true },
    }),
    // actual booked seats
    prisma.bookingSeat.count({
      where: { booking: { ...bookingWhere, status: "CONFIRMED" } },
    }),
  ]);

  const gross    = grossAgg._sum.amount       ?? 0;
  const refunded = refundAgg._sum.refundAmount ?? 0;
  const net      = gross - refunded;
  const totalSeats  = totalSeatsAgg._sum.totalSeats ?? 0;
  const fillRate    = totalSeats > 0 ? (bookedSeatsAgg / totalSeats) * 100 : 0;
  const avgTicket   = confirmedCount > 0 ? gross / confirmedCount : 0;

  return {
    gross,
    refunded,
    net,
    confirmedCount,
    cancelledCount,
    totalBookings: confirmedCount + cancelledCount,
    avgTicket,
    totalSeats,
    bookedSeats: bookedSeatsAgg,
    fillRate: Math.min(fillRate, 100),
    gatewayBreakdown: [
      { gateway: "RAZORPAY", amount: razorpayAgg._sum.amount ?? 0, count: razorpayAgg._count.id },
      { gateway: "CASH",     amount: cashAgg._sum.amount     ?? 0, count: cashAgg._count.id },
      { gateway: "FREE",     amount: freeAgg._sum.amount     ?? 0, count: freeAgg._count.id },
    ].filter(g => g.count > 0),
  };
};

// ─── Per-show revenue breakdown (the main table) ──────────────────────────────
export const getRevenueByShowService = async (loginId: string, role: string) => {
  const showFilter = role === "ADMIN" ? {} : { loginId };

  const shows = await prisma.show.findMany({
    where: showFilter,
    select: {
      id: true, title: true, date: true, time: true,
      venue: true, city: true, status: true,
      totalSeats: true,
      seatCategories: {
        select: { id: true, name: true, color: true, price: true },
      },
      bookings: {
        where: { status: { in: ["CONFIRMED", "CANCELLED"] } },
        select: {
          id: true, status: true, quantity: true, totalAmount: true,
          transaction: { select: { amount: true, status: true, gateway: true, paidAt: true } },
          cancellation: { select: { refundAmount: true, refundStatus: true } },
          seats: { select: { pricePaid: true, categoryId: true } },
        },
      },
    },
    orderBy: { date: "desc" },
  });

  return shows.map(show => {
    const confirmed = show.bookings.filter(b => b.status === "CONFIRMED");
    const cancelled = show.bookings.filter(b => b.status === "CANCELLED");

    const gross    = confirmed
      .map(b => b.transaction)
      .filter(t => t?.status === "PAID")
      .reduce((s, t) => s + (t?.amount ?? 0), 0);

    const refunded = cancelled
      .reduce((s, b) => s + (b.cancellation?.refundAmount ?? 0), 0);

    const seatsSold = confirmed.reduce((s, b) => s + b.quantity, 0);
    const fillRate  = show.totalSeats > 0
      ? Math.min((seatsSold / show.totalSeats) * 100, 100)
      : 0;

    // potential = sum of all seat category prices × seats in each category
    // simplified: total seats × avg price across categories
    const avgCatPrice = show.seatCategories.length > 0
      ? show.seatCategories.reduce((s, c) => s + c.price, 0) / show.seatCategories.length
      : 0;
    const potential = show.totalSeats * avgCatPrice;
    const collectionRate = potential > 0 ? Math.min((gross / potential) * 100, 100) : 0;

    // Category-level revenue
    const catMap: Record<string, { name: string; color: string; revenue: number; seats: number }> = {};
    confirmed.forEach(b => b.seats.forEach(seat => {
      const cat = show.seatCategories.find(c => c.id === seat.categoryId);
      if (!cat) return;
      if (!catMap[seat.categoryId]) catMap[seat.categoryId] = { name: cat.name, color: cat.color, revenue: 0, seats: 0 };
      catMap[seat.categoryId].revenue += seat.pricePaid;
      catMap[seat.categoryId].seats   += 1;
    }));

    // Gateway split for this show
    const gateways: Record<string, number> = {};
    confirmed.forEach(b => {
      const gw = b.transaction?.gateway;
      if (gw && b.transaction?.status === "PAID") {
        gateways[gw] = (gateways[gw] ?? 0) + (b.transaction.amount ?? 0);
      }
    });

    return {
      showId:          show.id,
      title:           show.title,
      date:            show.date.toISOString(),
      time:            show.time,
      venue:           show.venue,
      city:            show.city,
      status:          show.status,
      totalSeats:      show.totalSeats,
      seatsSold,
      fillRate,
      confirmedCount:  confirmed.length,
      cancelledCount:  cancelled.length,
      gross,
      refunded,
      net:             gross - refunded,
      potential,
      collectionRate,
      avgTicket:       seatsSold > 0 ? gross / seatsSold : 0,
      categoryRevenue: Object.values(catMap).sort((a, b) => b.revenue - a.revenue),
      gatewaySplit:    Object.entries(gateways).map(([gateway, amount]) => ({ gateway, amount })),
    };
  });
};

// ─── Transaction-level list (drill-down) ─────────────────────────────────────
export const getRevenueTransactionsService = async (
  loginId: string,
  role: string,
  showId?: string
) => {
  const showFilter = role === "ADMIN" ? {} : { loginId };

  return prisma.transaction.findMany({
    where: {
      status: "PAID",
      booking: {
        show: showId ? { id: showId, ...showFilter } : showFilter,
      },
    },
    include: {
      booking: {
        select: {
          bookingRef: true, bookerName: true, bookerPhone: true,
          bookerEmail: true, quantity: true, totalAmount: true,
          createdAt: true,
          show: { select: { id: true, title: true, date: true, city: true } },
          seats: {
            include: {
              category: { select: { name: true, color: true } },
              seat:     { select: { seatCode: true } },
            },
          },
          cancellation: { select: { refundAmount: true, refundStatus: true, cancelledAt: true } },
        },
      },
    },
    orderBy: { paidAt: "desc" },
  });
};