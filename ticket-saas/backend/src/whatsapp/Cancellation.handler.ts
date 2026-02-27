import prisma from "../utils/prisma";
import {
  sendWhatsAppMessage,
  sendWhatsAppImage,
  sendWhatsAppButtons,
  sendWhatsAppList,
} from "../services/whatsapp.service";
import {
  getSession,
  updateSession,
  deleteSession,
  Session,
} from "./session.store";
import { formatDate, generateAndSaveQR } from "./booking.handler";

// ─── Refund slab resolver ─────────────────────────────────────────────────────
/**
 * Reads the show's refundSlabs JSON (set by the CLIENT during show creation).
 *
 * Expected shape in Show.refundSlabs:
 *   [
 *     { "hoursThreshold": 48, "refundPercent": 100 },
 *     { "hoursThreshold": 24, "refundPercent": 50  },
 *     { "hoursThreshold": 0,  "refundPercent": 0   }
 *   ]
 *
 * Slabs are sorted descending. First slab where hoursBeforeShow >= hoursThreshold wins.
 * If no slab matches, 0% refund is returned.
 */
export const resolveRefundPercent = (
  refundSlabs: unknown,
  hoursBeforeShow: number,
  cancellationAllowed: boolean
): number => {
  if (!cancellationAllowed) return 0;
  if (!Array.isArray(refundSlabs) || refundSlabs.length === 0) return 0;

  // Key in DB is "hoursBeforeShow" (not "hoursThreshold")
  // Sort descending so highest threshold is checked first
  const sorted = [...refundSlabs].sort(
    (a: any, b: any) => b.hoursBeforeShow - a.hoursBeforeShow
  );

  for (const slab of sorted) {
    if (hoursBeforeShow >= (slab.hoursBeforeShow as number)) {
      return slab.refundPercent as number;
    }
  }
  return 0;
};

// ─── CANCEL STEP 1: User types CANCEL → check eligibility → offer Full/Partial ─
export const handleCancelIntent = async (
  from: string,
  session: Session
): Promise<void> => {
  const booking = await prisma.booking.findUnique({
    where: { id: session.bookingId },
    include: {
      show: true,
      seats: { include: { seat: true } },
    },
  });

  if (!booking || booking.status !== "CONFIRMED") {
    await sendWhatsAppMessage(
      from,
      `❌ No active booking found.\n\nScan the show QR code to make a new booking.`
    );
    deleteSession(from);
    return;
  }

  // ── Check client's cancellation setting on the show ───────────────────────
  if (!booking.show.cancellationAllowed) {
    await sendWhatsAppMessage(
      from,
      `❌ *Cancellation is not available* for this show.\n\n` +
        `The organiser has disabled cancellations.\n\n` +
        `For assistance, please contact the venue directly.`
    );
    return;
  }

  const hoursBeforeShow =
    (new Date(booking.show.date).getTime() - Date.now()) / (1000 * 60 * 60);

  if (hoursBeforeShow <= 0) {
    await sendWhatsAppMessage(
      from,
      `❌ *Cancellation not available* — the show has already started or ended.`
    );
    return;
  }

  // ── Resolve refund % from client's refundSlabs ────────────────────────────
  const refundPercent = resolveRefundPercent(
    booking.show.refundSlabs,
    hoursBeforeShow,
    booking.show.cancellationAllowed
  );

  if (refundPercent === 0) {
    await sendWhatsAppMessage(
      from,
      `❌ *Cancellation window has closed.*\n\n` +
        `No refund is applicable based on the organiser's cancellation policy.\n\n` +
        `For assistance, please contact the venue directly.`
    );
    return;
  }

  const seatCodes = booking.seats.map((bs) => bs.seat.seatCode);
  const perSeatRefund = (booking.totalAmount / booking.quantity) * (refundPercent / 100);

  // Store cancellation context in session
  updateSession(from, {
    step: "AWAITING_CANCEL_TYPE",
    cancelBookingId: booking.id,
    cancelableSeats: seatCodes,
    selectedCancelSeats: [],
  });

  // Two options: cancel all seats OR cancel some seats
  await sendWhatsAppButtons(
    from,
    `🚫 *Cancellation Request*\n\n` +
      `Booking: *${booking.bookingRef}*\n` +
      `Seats: *${seatCodes.join(", ")}*\n\n` +
      `💰 *Refund Policy (set by organiser):*\n` +
      `• Refund rate: *${refundPercent}%* of amount paid\n` +
      `• Per seat refund: *₹${perSeatRefund.toFixed(0)}*\n\n` +
      `What would you like to cancel?`,
    [
      { id: "CANCEL_FULL", title: "❌ Cancel All Seats" },
      { id: "CANCEL_PARTIAL", title: "🔄 Cancel Some Seats" },
    ],
    `❌ Cancel Booking`,
    `Refund credited within 24 hours`
  );
};

// ─── CANCEL STEP 2a: Full cancellation ───────────────────────────────────────
export const handleCancelFull = async (
  from: string,
  session: Session
): Promise<void> => {
  const booking = await prisma.booking.findUnique({
    where: { id: session.cancelBookingId },
    include: {
      show: true,
      seats: { include: { seat: true, category: true } },
    },
  });

  if (!booking) {
    await sendWhatsAppMessage(from, `❌ Booking not found.`);
    deleteSession(from);
    return;
  }

  const hoursBeforeShow =
    (new Date(booking.show.date).getTime() - Date.now()) / (1000 * 60 * 60);

  const refundPercent = resolveRefundPercent(
    booking.show.refundSlabs,
    hoursBeforeShow,
    booking.show.cancellationAllowed
  );

  const totalRefund = parseFloat(
    (booking.totalAmount * (refundPercent / 100)).toFixed(2)
  );
  const seatCodes = booking.seats.map((bs) => bs.seat.seatCode);

  // Release all seats back to AVAILABLE
  await prisma.seat.updateMany({
    where: { id: { in: booking.seats.map((bs) => bs.seatId) } },
    data: { status: "AVAILABLE", lockedUntil: null },
  });

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "CANCELLED" },
  });

  // cancelledById = show.loginId (the client who created the show)
  // This is the correct FK — the client owns the show and its cancellation policy
  await prisma.cancellation.create({
    data: {
      bookingId: booking.id,
      cancelledById: booking.show.loginId,
      reason: "Customer requested full cancellation via WhatsApp",
      refundAmount: totalRefund,
      refundPercent,
      hoursBeforeShow,
      refundStatus: "PENDING",
    },
  });

  await prisma.bookingLog.create({
    data: {
      bookingId: booking.id,
      showId: session.showId,
      action: "BOOKING_CANCELLED",
      description: `Full cancellation by customer: ${seatCodes.join(", ")}`,
      metadata: { cancelledSeats: seatCodes, refundAmount: totalRefund, refundPercent },
    },
  });

  deleteSession(from);

  await sendWhatsAppMessage(
    from,
    `✅ *Booking Fully Cancelled*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📋 *Cancellation Summary*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `• Ref: *${booking.bookingRef}*\n` +
      `• Cancelled Seats: *${seatCodes.join(", ")}*\n` +
      `• Paid Amount: ₹${booking.totalAmount.toLocaleString("en-IN")}\n` +
      `• Refund (${refundPercent}%): *₹${totalRefund.toLocaleString("en-IN")}*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💰 *₹${totalRefund.toLocaleString("en-IN")} will be credited to your account within 24 hours.*\n\n` +
      `Scan the show QR code to make a new booking. 👋`
  );
};

// ─── CANCEL STEP 2b: Partial — show seat checkbox list ───────────────────────
export const handleCancelPartialStart = async (
  from: string,
  session: Session
): Promise<void> => {
  updateSession(from, { step: "AWAITING_CANCEL_SEATS", selectedCancelSeats: [] });
  const updated = getSession(from)!;
  await sendCancelSeatCheckboxList(from, updated);
};

/**
 * Renders the partial cancellation seat picker.
 * Mirrors the booking seat-selection checkbox pattern:
 * - Shows only UN-ticked seats in the list
 * - Ticked seats shown in body text as [A1] [B2]
 * - Confirm + Clear buttons appear once ≥1 seat is ticked
 */
export const sendCancelSeatCheckboxList = async (
  from: string,
  session: Session
): Promise<void> => {
  const allSeats = session.cancelableSeats ?? [];
  const ticked = session.selectedCancelSeats ?? [];
  const unticked = allSeats.filter((c) => !ticked.includes(c));

  const tickedLine =
    ticked.length > 0
      ? `🗑️ *Marked for cancellation (${ticked.length}/${allSeats.length}):*\n${ticked.map((c) => `[${c}]`).join(" ")}\n\n`
      : "";

  // Show remaining un-ticked seats in list
  if (unticked.length > 0) {
    const seatRows = unticked.map((code) => ({
      id: `CXSEAT_${code}`,
      title: `Seat ${code}`,
      description: `Tap to mark for cancellation`,
    }));

    await sendWhatsAppList(
      from,
      `${tickedLine}Tap a seat to mark it for cancellation:`,
      "Select Seat",
      [{ title: "🪑 Your Booked Seats", rows: seatRows }],
      `❌ Select Seats to Cancel`,
      "Tap Done when finished"
    );
  } else if (ticked.length > 0) {
    // All seats ticked — no list needed, just the confirm buttons
    await sendWhatsAppMessage(
      from,
      `${tickedLine}All seats marked. Tap *Confirm* to proceed.`
    );
  }

  // Show Confirm + Clear once ≥1 seat is ticked
  if (ticked.length > 0) {
    // Fetch booking to calculate refund preview
    const booking = await prisma.booking.findUnique({
      where: { id: session.cancelBookingId },
      include: {
        show: true,
        seats: { include: { seat: true, category: true } },
      },
    });

    if (booking) {
      const hoursBeforeShow =
        (new Date(booking.show.date).getTime() - Date.now()) / (1000 * 60 * 60);
      const refundPercent = resolveRefundPercent(
        booking.show.refundSlabs,
        hoursBeforeShow,
        booking.show.cancellationAllowed
      );
      const perSeatPaid = booking.totalAmount / booking.quantity;
      const cancelRefund = parseFloat(
        (ticked.length * perSeatPaid * (refundPercent / 100)).toFixed(2)
      );

      await sendWhatsAppButtons(
        from,
        `*Seats to cancel:* ${ticked.join(", ")}\n\n` +
          `💰 Refund for selected: *₹${cancelRefund.toLocaleString("en-IN")}* (${refundPercent}%)\n\n` +
          (unticked.length > 0
            ? `You can still tick more seats above, or tap *Confirm* to proceed.`
            : `All seats selected. Tap *Confirm* to complete cancellation.`),
        [
          { id: "CONFIRM_CANCEL", title: "✅ Confirm Cancel" },
          { id: "CANCEL_CLEAR_TICKS", title: "🔄 Clear Selection" },
        ],
        `❌ Confirm Cancellation`,
        `Refund credited within 24 hours`
      );
    }
  }
};

// ─── CANCEL STEP 3: Toggle a seat tick ───────────────────────────────────────
export const handleCancelSeatToggle = async (
  from: string,
  session: Session,
  interactiveId: string
): Promise<void> => {
  const seatCode = interactiveId.replace("CXSEAT_", "");
  const allSeats = session.cancelableSeats ?? [];

  if (!allSeats.includes(seatCode)) {
    await sendWhatsAppMessage(from, `❌ Seat *${seatCode}* is not part of your booking.`);
    return;
  }

  const ticked = session.selectedCancelSeats ?? [];
  const newTicked = ticked.includes(seatCode)
    ? ticked.filter((c) => c !== seatCode)   // untick
    : [...ticked, seatCode];                 // tick

  updateSession(from, { selectedCancelSeats: newTicked });

  const updated = getSession(from)!;
  await sendCancelSeatCheckboxList(from, updated);
};

// ─── CANCEL STEP 4: Clear tick selection ─────────────────────────────────────
export const handleCancelClearTicks = async (
  from: string,
  session: Session
): Promise<void> => {
  updateSession(from, { selectedCancelSeats: [] });
  await sendWhatsAppMessage(from, `🔄 Selection cleared. Tap seats to re-select.`);
  const updated = getSession(from)!;
  await sendCancelSeatCheckboxList(from, updated);
};

// ─── CANCEL STEP 5: Confirm cancellation (partial or full via partial flow) ───
export const handleConfirmCancellation = async (
  from: string,
  session: Session
): Promise<void> => {
  const ticked = session.selectedCancelSeats ?? [];

  if (ticked.length === 0) {
    await sendWhatsAppMessage(
      from,
      `⚠️ No seats selected. Tap seats to mark for cancellation, then tap *Confirm*.`
    );
    await sendCancelSeatCheckboxList(from, session);
    return;
  }

  const booking = await prisma.booking.findUnique({
    where: { id: session.cancelBookingId },
    include: {
      show: true,
      seats: { include: { seat: true, category: true } },
    },
  });

  if (!booking) {
    await sendWhatsAppMessage(from, `❌ Booking not found.`);
    deleteSession(from);
    return;
  }

  const hoursBeforeShow =
    (new Date(booking.show.date).getTime() - Date.now()) / (1000 * 60 * 60);

  // Re-resolve refund % using show's client-defined slabs
  const refundPercent = resolveRefundPercent(
    booking.show.refundSlabs,
    hoursBeforeShow,
    booking.show.cancellationAllowed
  );

  const isFullCancellation = ticked.length === booking.quantity;

  const seatsToCancel = booking.seats.filter((bs) =>
    ticked.includes(bs.seat.seatCode)
  );
  const cancelledAmount = seatsToCancel.reduce((sum, bs) => sum + bs.pricePaid, 0);
  const totalRefund = parseFloat(
    (cancelledAmount * (refundPercent / 100)).toFixed(2)
  );

  // Release the cancelled seats
  await prisma.seat.updateMany({
    where: { id: { in: seatsToCancel.map((bs) => bs.seatId) } },
    data: { status: "AVAILABLE", lockedUntil: null },
  });

  // cancelledById = show.loginId — the client who owns this show
  const cancelledById = booking.show.loginId;

  if (isFullCancellation) {
    // ────────────────────────────────────────────────────────────────────────
    // FULL CANCELLATION
    // ────────────────────────────────────────────────────────────────────────
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED" },
    });

    await prisma.cancellation.create({
      data: {
        bookingId: booking.id,
        cancelledById,
        reason: "Customer cancelled all seats via WhatsApp partial flow",
        refundAmount: totalRefund,
        refundPercent,
        hoursBeforeShow,
        refundStatus: "PENDING",
      },
    });

    await prisma.bookingLog.create({
      data: {
        bookingId: booking.id,
        showId: session.showId,
        action: "BOOKING_CANCELLED",
        description: `All seats cancelled: ${ticked.join(", ")}`,
        metadata: { cancelledSeats: ticked, refundAmount: totalRefund, refundPercent },
      },
    });

    deleteSession(from);

    await sendWhatsAppMessage(
      from,
      `✅ *Booking Fully Cancelled*\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `• Ref: *${booking.bookingRef}*\n` +
        `• Cancelled Seats: *${ticked.join(", ")}*\n` +
        `• Refund (${refundPercent}%): *₹${totalRefund.toLocaleString("en-IN")}*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `💰 *₹${totalRefund.toLocaleString("en-IN")} will be credited within 24 hours.*\n\n` +
        `Scan the show QR to make a new booking. 👋`
    );
  } else {
    // ────────────────────────────────────────────────────────────────────────
    // PARTIAL CANCELLATION
    // ────────────────────────────────────────────────────────────────────────
    const remainingBookingSeats = booking.seats.filter(
      (bs) => !ticked.includes(bs.seat.seatCode)
    );
    const remainingCodes = remainingBookingSeats.map((bs) => bs.seat.seatCode);
    const remainingTotal = remainingBookingSeats.reduce((sum, bs) => sum + bs.pricePaid, 0);

    // Update booking — new quantity and total
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        quantity: remainingCodes.length,
        totalAmount: remainingTotal,
      },
    });

    await prisma.cancellation.create({
      data: {
        bookingId: booking.id,
        cancelledById,
        reason: `Customer partially cancelled seats: ${ticked.join(", ")}`,
        refundAmount: totalRefund,
        refundPercent,
        hoursBeforeShow,
        refundStatus: "PENDING",
      },
    });

    await prisma.bookingLog.create({
      data: {
        bookingId: booking.id,
        showId: session.showId,
        action: "BOOKING_CANCELLED",
        description: `Partial cancel: ${ticked.join(", ")} | Remaining: ${remainingCodes.join(", ")}`,
        metadata: {
          cancelledSeats: ticked,
          remainingSeats: remainingCodes,
          refundAmount: totalRefund,
          refundPercent,
        },
      },
    });

    // Generate new QR for remaining seats
    const newQrData = `TICKET:${booking.bookingRef}:${booking.showId}:${remainingCodes.join(",")}`;
    const newQrUrl = await generateAndSaveQR(newQrData);

    await prisma.booking.update({
      where: { id: booking.id },
      data: { ticketQR: newQrUrl },
    });

    // Stay CONFIRMED — user can type CANCEL again to cancel remaining seats
    updateSession(from, {
      step: "CONFIRMED",
      selectedSeats: remainingCodes,
      cancelBookingId: undefined,
      cancelableSeats: undefined,
      selectedCancelSeats: undefined,
    });

    // Cancellation summary
    await sendWhatsAppMessage(
      from,
      `✅ *Partial Cancellation Done*\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📋 *Cancellation Summary*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `• Cancelled Seats: *${ticked.join(", ")}*\n` +
        `• Refund (${refundPercent}%): *₹${totalRefund.toLocaleString("en-IN")}*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `💰 *₹${totalRefund.toLocaleString("en-IN")} will be credited to your account within 24 hours.*`
    );

    // Updated ticket + new QR
    await sendWhatsAppMessage(
      from,
      `🎟️ *Updated Ticket Details*\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🎭 *${booking.show.title}*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📍 ${booking.show.venue}, ${booking.show.city}\n` +
        `📅 ${formatDate(booking.show.date)}\n` +
        `🕐 ${booking.show.time}\n\n` +
        `🎫 *Remaining Seats:*\n` +
        `• Ref: *${booking.bookingRef}*\n` +
        `• Name: *${booking.bookerName}*\n` +
        `• Seats: *${remainingCodes.join(", ")}*\n` +
        `• Total: *₹${remainingTotal.toLocaleString("en-IN")}*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `_Previous QR is now invalid. Use the new QR below._\n` +
        `_To cancel more seats, type *CANCEL* again._`
    );

    await sendWhatsAppImage(
      from,
      newQrUrl,
      `🎟️ *Updated QR — ${booking.bookingRef}*\n\nPresent this at the entrance. Old QR is invalid.`
    );
  }
};