import prisma from "../utils/prisma";

// ─── Shows available to this validator ───────────────────────────────────────
export const getValidatorShowsService = async (loginId: string, role: string) => {
  const where =
    role === "ADMIN"  ? {} :
    role === "CLIENT" ? { loginId } :
    {};  // TICKET_VALIDATOR sees all published shows

  return await prisma.show.findMany({
    where: {
      ...where,
      status: { in: ["PUBLISHED", "BOOKING_ENABLED", "BOOKING_DISABLED"] },
    },
    select: {
      id: true, title: true, date: true,
      time: true, venue: true, city: true, status: true,
    },
    orderBy: { date: "asc" },
  });
};

// ─── Live check-in stats for a show ──────────────────────────────────────────
// invalidScans = TicketScan rows (isValid:false) + BookingLog BOOKING_NOT_FOUND rows
// This ensures BOOKING_NOT_FOUND attempts (which can't have a TicketScan row due to FK)
// are still counted and persist across restarts.
export const getScanStatsService = async (showId: string) => {
  const [total, checkedIn, confirmed, cancelled, invalidFromScan, invalidNotFound] =
    await Promise.all([
      prisma.booking.count({ where: { showId } }),
      prisma.booking.count({ where: { showId, status: "CHECKED_IN" } }),
      prisma.booking.count({ where: { showId, status: "CONFIRMED" } }),
      prisma.booking.count({
        where: { showId, status: { in: ["CANCELLED", "REFUNDED"] } },
      }),
      // Invalid scans where booking DID exist (stored in TicketScan)
      prisma.ticketScan.count({
        where: { booking: { showId }, isValid: false },
      }),
      // Invalid scans where booking NOT FOUND (stored in BookingLog as TICKET_SCANNED
      // with metadata.notFound = true, since TicketScan FK requires a real bookingId)
      prisma.bookingLog.count({
        where: {
          showId,
          action: "TICKET_SCANNED",
          metadata: { path: ["notFound"], equals: true },
        },
      }),
    ]);

  return {
    totalBookings: total,
    checkedIn,
    pending:      confirmed,  // confirmed but not yet checked in
    cancelled,
    invalidScans: invalidFromScan + invalidNotFound,
  };
};

// ─── Core verify ─────────────────────────────────────────────────────────────
// QR format:  TICKET:{bookingRef}:{showId}
// Only bookingRef is used — showId from the QR is ignored (we use the selected show).
//
// Persistence strategy for BOOKING_NOT_FOUND:
//   TicketScan has a non-nullable FK to Booking — we CANNOT write a TicketScan row
//   without a real booking. So for BOOKING_NOT_FOUND we write a BookingLog row instead
//   (no bookingId required there). This means the invalid count and history survive restarts.
export const verifyTicketService = async (
  bookingRef: string,
  showId:     string,
  scannedById: string,
  deviceInfo?: string
) => {

  // Step 1 — find booking by bookingRef
  const booking = await prisma.booking.findUnique({
    where: { bookingRef },
    include: {
      show: {
        select: { id: true, title: true, date: true, time: true, venue: true },
      },
      seats: {
        include: {
          seat:     { select: { seatCode: true, rowLabel: true } },
          category: { select: { name: true, color: true } },
        },
      },
    },
  });

  // BOOKING_NOT_FOUND — write to BookingLog (no TicketScan, FK would fail)
  if (!booking) {
    await prisma.bookingLog.create({
      data: {
        loginId:     scannedById,
        showId,
        action:      "TICKET_SCANNED",
        description: `Invalid scan — booking ref not found: ${bookingRef}`,
        metadata: {
          bookingRef,
          notFound:  true,   // ← flag used by getScanStatsService to count this
          deviceInfo,
        },
      },
    });
    return { valid: false, reason: "BOOKING_NOT_FOUND", booking: null };
  }

  // Helper — write TicketScan (booking exists, FK is satisfied) + return invalid
  const reject = async (reason: string) => {
    await prisma.ticketScan.create({
      data: {
        bookingId:     booking.id,
        scannedById,
        isValid:       false,
        invalidReason: reason,
        deviceInfo,
      },
    });
    return { valid: false, reason, booking: toPayload(booking) };
  };

  // Step 2 — wrong show
  if (booking.showId !== showId) return await reject("SHOW_MISMATCH");

  // Step 3 — status checks
  if (booking.status === "CANCELLED" || booking.status === "REFUNDED")
    return await reject("BOOKING_CANCELLED");

  if (booking.status === "CHECKED_IN")
    return await reject("ALREADY_CHECKED_IN");

  if (booking.status !== "CONFIRMED")
    return await reject("NOT_CONFIRMED");

  // Step 4 — ✅ Valid — atomic transaction
  await prisma.$transaction([
    prisma.booking.update({
      where: { id: booking.id },
      data:  { status: "CHECKED_IN" },
    }),
    prisma.ticketScan.create({
      data: {
        bookingId:   booking.id,
        scannedById,
        isValid:     true,
        deviceInfo,
      },
    }),
    prisma.bookingLog.create({
      data: {
        bookingId:   booking.id,
        loginId:     scannedById,
        showId:      booking.showId,
        action:      "TICKET_SCANNED",
        description: `Ticket validated for ${booking.bookerName}`,
        metadata:    { bookingRef, deviceInfo },
      },
    }),
  ]);

  return { valid: true, booking: toPayload(booking) };
};

// ─── Scan history (for the log tab) ──────────────────────────────────────────
// Merges two sources:
//   1. TicketScan rows  — all scans where booking was found (valid + invalid)
//   2. BookingLog rows  — BOOKING_NOT_FOUND scans (no TicketScan row possible)
// Both are sorted by time descending and merged before returning.
export const getScanHistoryService = async (showId: string, limit = 100) => {
  const [scans, notFoundLogs] = await Promise.all([

    // Source 1: TicketScan (booking found, valid or invalid)
    prisma.ticketScan.findMany({
      where:   { booking: { showId } },
      orderBy: { scannedAt: "desc" },
      take:    limit,
      include: {
        booking: {
          select: {
            bookingRef: true,
            bookerName: true,
            quantity:   true,
            seats: {
              include: { seat: { select: { seatCode: true } } },
            },
          },
        },
        scannedBy: { select: { name: true } },
      },
    }),

    // Source 2: BookingLog where booking was NOT FOUND
    prisma.bookingLog.findMany({
      where: {
        showId,
        action: "TICKET_SCANNED",
        metadata: { path: ["notFound"], equals: true },
      },
      orderBy: { createdAt: "desc" },
      take:    limit,
      include: {
        login: { select: { name: true } },
      },
    }),

  ]);

  // Shape TicketScan rows
  const fromScans = scans.map((s) => ({
    id:            s.id,
    isValid:       s.isValid,
    invalidReason: s.invalidReason ?? undefined,
    scannedAt:     s.scannedAt.toISOString(),
    scannedBy:     s.scannedBy.name,
    booking: {
      bookingRef: s.booking.bookingRef,
      bookerName: s.booking.bookerName,
      quantity:   s.booking.quantity,
      seats:      s.booking.seats.map((bs) => bs.seat.seatCode),
    },
  }));

  // Shape BookingLog (BOOKING_NOT_FOUND) rows
  const fromNotFound = notFoundLogs.map((l) => {
    const meta = (l.metadata ?? {}) as Record<string, any>;
    return {
      id:            l.id,
      isValid:       false,
      invalidReason: "BOOKING_NOT_FOUND",
      scannedAt:     l.createdAt.toISOString(),
      scannedBy:     l.login?.name ?? "Unknown",
      booking: {
        bookingRef: meta.bookingRef ?? "Unknown",
        bookerName: "—",         // no booking exists
        quantity:   0,
        seats:      [] as string[],
      },
    };
  });

  // Merge + sort by time desc + cap at limit
  return [...fromScans, ...fromNotFound]
    .sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime())
    .slice(0, limit);
};

// ─── Shape booking data for API response ─────────────────────────────────────
function toPayload(booking: any) {
  return {
    bookingRef:  booking.bookingRef,
    bookerName:  booking.bookerName,
    bookerPhone: booking.bookerPhone,
    bookerEmail: booking.bookerEmail,
    quantity:    booking.quantity,
    totalAmount: booking.totalAmount,
    status:      booking.status,
    seats:       (booking.seats ?? []).map((bs: any) => bs.seat.seatCode),
    show:        booking.show,
  };
}