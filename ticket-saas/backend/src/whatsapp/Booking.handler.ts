import prisma from "../utils/prisma";
import {
  sendWhatsAppMessage,
  sendWhatsAppImage,
  sendWhatsAppButtons,
  sendWhatsAppList,
} from "../services/whatsapp.service";
import {
  getSession,
  setSession,
  updateSession,
  deleteSession,
  Session,
} from "./session.store";
import { randomBytes } from "crypto";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const formatDate = (date: Date | string): string =>
  new Date(date).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

/**
 * Generates a QR code PNG, saves it to /public/qr/, returns a public HTTPS URL.
 *
 * WHY NOT base64: WhatsApp Cloud API only accepts public HTTPS image URLs.
 *
 * REQUIRED SETUP:
 *   1. .env → PUBLIC_BASE_URL=https://yourdomain.com
 *   2. server.ts →
 *        app.use("/qr", express.static(path.join(__dirname, "../public/qr")));
 */
export const generateAndSaveQR = async (data: string): Promise<string> => {
  const rawUrl = process.env.PUBLIC_BASE_URL ?? "";
  if (!rawUrl) {
    throw new Error(
      "[QR] PUBLIC_BASE_URL is not set in .env\n" +
      "  Add: PUBLIC_BASE_URL=https://chromosomally-unshakeable-tiffaney.ngrok-free.dev"
    );
  }

  // Auto-correct: strip any path accidentally added to the env var
  // "https://foo.ngrok.dev/api/whatsapp/webhook" → "https://foo.ngrok.dev"
  let baseUrl: string;
  try {
    const parsed = new URL(rawUrl);
    baseUrl = `${parsed.protocol}//${parsed.host}`;

    if (parsed.pathname !== "/") {
      console.warn(
        `[QR] ⚠️  PUBLIC_BASE_URL had an extra path "${parsed.pathname}" — stripped.\n` +
        `     Fix your .env: PUBLIC_BASE_URL=${baseUrl}`
      );
    }
  } catch {
    throw new Error(`[QR] PUBLIC_BASE_URL is not a valid URL: "${rawUrl}"`);
  }

  const filename  = `qr-${randomBytes(8).toString("hex")}.png`;
  const publicDir = path.join(process.cwd(), "public", "qr");

  fs.mkdirSync(publicDir, { recursive: true });

  const filePath = path.join(publicDir, filename);
  await QRCode.toFile(filePath, data, {
    width: 400,
    margin: 2,
    color: { dark: "#000000", light: "#FFFFFF" },
    errorCorrectionLevel: "H",
  });

  if (!fs.existsSync(filePath)) {
    throw new Error(`[QR] File was not written to: ${filePath}`);
  }

  const publicUrl = `${baseUrl}/qr/${filename}`;
  console.log(`[QR] ✅ ${publicUrl}`);
  return publicUrl;
};




// ─── STEP 1: Keyword trigger → greeting + poster ──────────────────────────────
export const handleKeywordTrigger = async (
  from: string,
  keyword: string
): Promise<void> => {
  const show = await prisma.show.findFirst({
    where: { whatsappKeyword: keyword },
    include: { seatCategories: true },
  });

  if (!show) {
    await sendWhatsAppMessage(from, `❌ *No show found.*\n\nPlease scan the QR code again.`);
    return;
  }

  if (show.status !== "BOOKING_ENABLED") {
    await sendWhatsAppMessage(
      from,
      `⚠️ *${show.title}* is not accepting bookings right now.\n\nPlease check back later.`
    );
    return;
  }

  // Always reset session — clears any stale state from a previous booking
  setSession(from, { step: "SHOW_DETAILS", showId: show.id, keyword });

  const caption =
    `🎉 *Welcome!*\n\n` +
    `🎭 *${show.title}*\n` +
    (show.description ? `📝 ${show.description}\n` : "") +
    `📍 *Venue:* ${show.venue}, ${show.city}\n` +
    `📅 *Date:* ${formatDate(show.date)}\n` +
    `🕐 *Time:* ${show.time}`;

  // Poster OR plain text — never both (that was the triple-message bug)
  if (show.posterImage?.startsWith("http")) {
    await sendWhatsAppImage(from, show.posterImage, caption);
  } else {
    await sendWhatsAppMessage(from, caption);
  }

  await sendWhatsAppButtons(
    from,
    `Would you like to book tickets for *${show.title}*?`,
    [
      { id: "BOOK_NOW", title: "🎟️ Book Now" },
      { id: "CANCEL", title: "❌ Cancel" },
    ],
    undefined,
    `Reply CANCEL anytime to stop`
  );
};

// ─── STEP 2: "Book Now" tapped → ask for user details ────────────────────────
export const handleBookNow = async (from: string): Promise<void> => {
  updateSession(from, { step: "COLLECTING_DETAILS" });

  await sendWhatsAppMessage(
    from,
    `✍️ *Please share your details to proceed:*\n\n` +
      `Send your info in this exact format:\n\n` +
      `NAME: Your Full Name\n` +
      `AGE: 25\n` +
      `EMAIL: your@email.com\n\n` +
      `_Reply CANCEL anytime to stop_`
  );
};

// ─── STEP 3: Details received → show info + category list ────────────────────
export const handleCollectDetails = async (
  from: string,
  session: Session,
  text: string
): Promise<void> => {
  const details: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx !== -1) {
      const key = line.substring(0, colonIdx).trim().toUpperCase();
      const val = line.substring(colonIdx + 1).trim();
      if (key) details[key] = val;
    }
  }

  const name = details["NAME"];
  const ageRaw = details["AGE"];
  const email = details["EMAIL"];
  const age = parseInt(ageRaw ?? "");

  if (!name || !ageRaw || !email) {
    await sendWhatsAppMessage(
      from,
      `❌ *Incomplete details.*\n\nPlease send all 3 fields:\n\n` +
        `NAME: Your Full Name\n` +
        `AGE: 25\n` +
        `EMAIL: your@email.com`
    );
    return;
  }

  if (isNaN(age) || age < 1 || age > 120) {
    await sendWhatsAppMessage(from, `❌ *Invalid age.* Please enter a valid age between 1 and 120.`);
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    await sendWhatsAppMessage(
      from,
      `❌ *Invalid email.* Please provide a valid email.\n\nExample: name@example.com`
    );
    return;
  }

  const show = await prisma.show.findUnique({
    where: { id: session.showId },
    include: { seatCategories: true },
  });

  if (!show) {
    await sendWhatsAppMessage(from, `❌ Show not found. Please scan the QR again.`);
    deleteSession(from);
    return;
  }

  updateSession(from, { step: "SELECTING_CATEGORY", name, age, email });

  const availableCount = await prisma.seat.count({
    where: { showId: show.id, status: "AVAILABLE", isBlocked: false },
  });

  await sendWhatsAppMessage(
    from,
    `👋 Hi *${name}!*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🎭 *${show.title}*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      (show.description ? `📝 ${show.description}\n\n` : "") +
      `📍 *Venue:* ${show.venue}, ${show.city}\n` +
      `📅 *Date:* ${formatDate(show.date)}\n` +
      `🕐 *Time:* ${show.time}\n` +
      `🪑 *Available Seats:* ${availableCount}\n` +
      `━━━━━━━━━━━━━━━━━━━━`
  );

  const categoryRows = await Promise.all(
    show.seatCategories.map(async (cat) => {
      const available = await prisma.seat.count({
        where: { showId: show.id, categoryId: cat.id, status: "AVAILABLE", isBlocked: false },
      });
      return {
        id: `CAT_${cat.id}`,
        title: `${cat.name} — ₹${cat.price}`,
        description: `${available} seats available`,
      };
    })
  );

  await sendWhatsAppList(
    from,
    `Please select your preferred seat category:`,
    "View Categories",
    [{ title: "🎫 Seat Categories", rows: categoryRows }],
    `🎭 ${show.title}`,
    "Prices are inclusive of all taxes"
  );
};

// ─── STEP 4: Category selected → quantity picker ─────────────────────────────
export const handleCategorySelected = async (
  from: string,
  session: Session,
  interactiveId: string
): Promise<void> => {
  const categoryId = interactiveId.replace("CAT_", "");
  const category = await prisma.seatCategory.findUnique({ where: { id: categoryId } });

  if (!category) {
    await sendWhatsAppMessage(from, `❌ Category not found. Please try again.`);
    return;
  }

  const available = await prisma.seat.count({
    where: { showId: session.showId, categoryId, status: "AVAILABLE", isBlocked: false },
  });

  if (available === 0) {
    await sendWhatsAppMessage(
      from,
      `😔 *${category.name}* is fully booked.\n\nPlease select a different category.`
    );
    return;
  }

  updateSession(from, { step: "SELECTING_QUANTITY", categoryId });

  const maxSeats = Math.min(5, available);
  const quantityRows = Array.from({ length: maxSeats }, (_, i) => ({
    id: `QTY_${i + 1}`,
    title: `${i + 1} Seat${i + 1 > 1 ? "s" : ""}`,
    description: `Total: ₹${((i + 1) * category.price).toLocaleString("en-IN")}`,
  }));

  await sendWhatsAppList(
    from,
    `You selected *${category.name}* at *₹${category.price}* per seat.\n\n` +
      `*${available}* seats available.\n\nHow many seats do you need?`,
    "Select Quantity",
    [{ title: "🪑 Number of Seats", rows: quantityRows }],
    `💺 Select Quantity`,
    "Maximum 5 seats per booking"
  );
};

// ─── STEP 5: Quantity selected → seat selection ───────────────────────────────
export const handleQuantitySelected = async (
  from: string,
  session: Session,
  interactiveId: string
): Promise<void> => {
  const qty = parseInt(interactiveId.replace("QTY_", ""));

  if (isNaN(qty) || qty < 1 || qty > 5) {
    await sendWhatsAppMessage(from, `❌ Invalid selection. Please choose between 1 and 5.`);
    return;
  }

  updateSession(from, { step: "SELECTING_SEATS", quantity: qty, selectedSeats: [] });
  await sendSeatCheckboxList(from, session.showId, session.categoryId!, [], qty);
};

/**
 * Seat selection UI — simulates checkbox behaviour.
 *
 * KEY RULE (over-selection fix):
 *   When alreadySelected.length >= quantity, the seat list is NOT rendered.
 *   Only Done/Clear buttons are shown. The user literally cannot tap another seat
 *   from the list because the list is not sent. handleSeatSelected also has a
 *   hard cap guard as a second line of defence.
 */
export const sendSeatCheckboxList = async (
  from: string,
  showId: string,
  categoryId: string,
  alreadySelected: string[],
  quantity: number
): Promise<void> => {
  const remaining = quantity - alreadySelected.length;

  const selectedLine =
    alreadySelected.length > 0
      ? `✅ *Selected (${alreadySelected.length}/${quantity}):* ${alreadySelected.map((c) => `[${c}]`).join(" ")}\n\n`
      : "";

  // ── Quota filled — show ONLY Done/Clear, no seat list ────────────────────
  if (remaining <= 0) {
    await sendWhatsAppButtons(
      from,
      `${selectedLine}🎉 All *${quantity}* seat(s) selected!\n\nTap *Done* to proceed to payment.`,
      [
        { id: "SEATS_DONE", title: "✅ Done" },
        { id: "SEATS_CLEAR", title: "🔄 Clear & Restart" },
      ],
      `💺 Confirm Your Seats`,
      `Or clear to pick different seats`
    );
    return; // ← list is never sent when quota is full
  }

  // ── Still need more seats — show available list ──────────────────────────
  const availableSeats = await prisma.seat.findMany({
    where: {
      showId,
      categoryId,
      status: "AVAILABLE",
      isBlocked: false,
      seatCode: { notIn: alreadySelected },
    },
    include: { category: true },
    orderBy: [{ rowLabel: "asc" }, { seatNumber: "asc" }],
    take: 10,
  });

  if (availableSeats.length === 0) {
    await sendWhatsAppMessage(
      from,
      `😔 No more seats available in this category.\n\nReply CANCEL to start over.`
    );
    return;
  }

  const seatRows = availableSeats.map((s) => ({
    id: `SEAT_${s.seatCode}`,
    title: `Seat ${s.seatCode}`,
    description: `Row ${s.rowLabel} • ₹${s.category.price}`,
  }));

  await sendWhatsAppList(
    from,
    `${selectedLine}Choose *${remaining}* more seat(s):`,
    "Choose Seat",
    [{ title: `🪑 Available Seats`, rows: seatRows }],
    `💺 Seat Selection (${alreadySelected.length}/${quantity})`,
    `${remaining} more seat(s) to select`
  );

  // After ≥1 seat selected, also show Done/Clear buttons
  if (alreadySelected.length > 0) {
    await sendWhatsAppButtons(
      from,
      `*Selected so far:* ${alreadySelected.join(", ")}\n\n` +
        `Need *${remaining}* more, or tap *Done* to proceed with current selection.`,
      [
        { id: "SEATS_DONE", title: "✅ Done" },
        { id: "SEATS_CLEAR", title: "🔄 Clear & Restart" },
      ],
      `💺 Or Confirm Now`,
      `Tap Done to proceed with ${alreadySelected.length} seat(s)`
    );
  }
};

// ─── STEP 6a: A seat is tapped ────────────────────────────────────────────────
export const handleSeatSelected = async (
  from: string,
  session: Session,
  interactiveId: string
): Promise<void> => {
  const seatCode = interactiveId.replace("SEAT_", "");
  const selected = session.selectedSeats ?? [];
  const quantity = session.quantity ?? 0;

  // ── Hard cap guard (second line of defence after sendSeatCheckboxList) ───
  if (selected.length >= quantity) {
    await sendWhatsAppButtons(
      from,
      `⚠️ You've already selected *${quantity}* seat(s) — the maximum.\n\n` +
        `*Selected:* ${selected.join(", ")}\n\nTap *Done* to proceed or *Clear* to restart.`,
      [
        { id: "SEATS_DONE", title: "✅ Done" },
        { id: "SEATS_CLEAR", title: "🔄 Clear & Restart" },
      ],
      `💺 Maximum Reached`
    );
    return;
  }

  if (selected.includes(seatCode)) {
    await sendWhatsAppMessage(from, `⚠️ Seat *${seatCode}* is already selected. Pick a different seat.`);
    return;
  }

  const seat = await prisma.seat.findFirst({
    where: { showId: session.showId, seatCode, status: "AVAILABLE", isBlocked: false },
  });

  if (!seat) {
    await sendWhatsAppMessage(from, `❌ Seat *${seatCode}* was just taken. Please choose another.`);
    return;
  }

  const newSelected = [...selected, seatCode];
  updateSession(from, { selectedSeats: newSelected });

  // Re-render; if newSelected.length === quantity, only Done/Clear will show
  await sendSeatCheckboxList(from, session.showId, session.categoryId!, newSelected, quantity);
};

// ─── STEP 6b: Clear all seat selections ──────────────────────────────────────
export const handleSeatsClear = async (from: string, session: Session): Promise<void> => {
  updateSession(from, { selectedSeats: [] });
  await sendWhatsAppMessage(from, `🔄 Selection cleared. Please choose your seats again.`);
  await sendSeatCheckboxList(from, session.showId, session.categoryId!, [], session.quantity!);
};

// ─── STEP 6c: Done tapped → verify + lock seats + payment summary ─────────────
export const handleSeatsDone = async (from: string, session: Session): Promise<void> => {
  const selected = session.selectedSeats ?? [];

  if (selected.length === 0) {
    await sendWhatsAppMessage(from, `⚠️ No seats selected yet. Please tap at least one seat.`);
    await sendSeatCheckboxList(from, session.showId, session.categoryId!, [], session.quantity!);
    return;
  }

  // Final availability check
  const seats = await prisma.seat.findMany({
    where: {
      showId: session.showId,
      seatCode: { in: selected },
      status: "AVAILABLE",
      isBlocked: false,
    },
    include: { category: true },
  });

  if (seats.length !== selected.length) {
    const foundCodes = new Set(seats.map((s) => s.seatCode));
    const gone = selected.filter((c) => !foundCodes.has(c));
    const stillGood = selected.filter((c) => foundCodes.has(c));
    updateSession(from, { selectedSeats: stillGood });

    await sendWhatsAppMessage(
      from,
      `❌ Seat(s) *${gone.join(", ")}* were just taken.\n\n` +
        (stillGood.length > 0
          ? `Remaining: *${stillGood.join(", ")}*. Please choose *${session.quantity! - stillGood.length}* replacement(s).`
          : `Please choose your seats again.`)
    );
    await sendSeatCheckboxList(from, session.showId, session.categoryId!, stillGood, session.quantity!);
    return;
  }

  // Lock seats for 10 minutes
  const lockExpiry = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.seat.updateMany({
    where: { id: { in: seats.map((s) => s.id) } },
    data: { status: "LOCKED", lockedUntil: lockExpiry },
  });

  const totalAmount = seats.reduce((sum, s) => sum + s.category.price, 0);
  const bookingRef = `BK-${randomBytes(4).toString("hex").toUpperCase()}`;

  const booking = await prisma.booking.create({
    data: {
      bookingRef,
      showId: session.showId,
      bookerName: session.name!,
      bookerAge: session.age!,
      bookerEmail: session.email!,
      bookerPhone: from,
      quantity: selected.length,
      totalAmount,
      status: "SEATS_SELECTED",
      source: "WHATSAPP",
      seats: {
        create: seats.map((s) => ({
          seatId: s.id,
          categoryId: s.categoryId,
          pricePaid: s.category.price,
        })),
      },
    },
  });

  await prisma.bookingLog.create({
    data: {
      bookingId: booking.id,
      showId: session.showId,
      action: "SEATS_LOCKED",
      description: `Seats locked: ${selected.join(", ")}`,
      metadata: { seatCodes: selected, lockExpiry },
    },
  });

  updateSession(from, { step: "AWAITING_PAYMENT", bookingId: booking.id });

  await sendWhatsAppButtons(
    from,
    `🔒 *Seats locked for 10 minutes!*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `💳 *Payment Summary*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `• Ref: *${bookingRef}*\n` +
      `• Name: ${session.name}\n` +
      `• Age: ${session.age}\n` +
      `• Seats: *${selected.join(", ")}*\n` +
      `• Qty: ${selected.length} seat(s)\n` +
      `• Total: *₹${totalAmount.toLocaleString("en-IN")}*\n` +
      `━━━━━━━━━━━━━━━━━━━━`,
    [
      { id: "CONFIRM_PAYMENT", title: `✅ Pay ₹${totalAmount}` },
      { id: "CANCEL", title: "❌ Cancel" },
    ],
    `🎟️ Complete Payment`,
    `⏰ Seats release in 10 min if unpaid`
  );
};

// ─── STEP 7: Payment confirmed → issue ticket ─────────────────────────────────
export const handleConfirmPayment = async (from: string, session: Session): Promise<void> => {
  const booking = await prisma.booking.findUnique({
    where: { id: session.bookingId },
    include: {
      seats: { include: { seat: true, category: true } },
      show: true,
    },
  });

  if (!booking) {
    await sendWhatsAppMessage(from, `❌ Booking not found. Please scan the QR code to start again.`);
    deleteSession(from);
    return;
  }

  const lockedSeats = await prisma.seat.findMany({
    where: { id: { in: booking.seats.map((bs) => bs.seatId) }, status: "LOCKED" },
  });

  if (lockedSeats.length !== booking.quantity) {
    await prisma.booking.update({ where: { id: booking.id }, data: { status: "EXPIRED" } });
    await prisma.bookingLog.create({
      data: {
        bookingId: booking.id,
        showId: session.showId,
        action: "BOOKING_EXPIRED",
        description: "Seat lock expired before payment",
      },
    });
    deleteSession(from);

    await sendWhatsAppButtons(
      from,
      `⏰ *Your seat lock expired!*\n\nSeats have been released. Would you like to try again?`,
      [
        { id: "BOOK_NOW", title: "🔄 Try Again" },
        { id: "CANCEL", title: "❌ No Thanks" },
      ]
    );
    return;
  }

  await prisma.seat.updateMany({
    where: { id: { in: lockedSeats.map((s) => s.id) } },
    data: { status: "BOOKED", lockedUntil: null },
  });

  await prisma.transaction.create({
    data: {
      bookingId: booking.id,
      amount: booking.totalAmount,
      currency: "INR",
      gateway: "CASH",
      status: "PAID",
      paidAt: new Date(),
    },
  });

  // QR saved as PNG file → served at PUBLIC_BASE_URL/qr/filename.png
  const qrData = `TICKET:${booking.bookingRef}:${booking.showId}`;
  const qrImageUrl = await generateAndSaveQR(qrData);

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "CONFIRMED", ticketQR: qrImageUrl, ticketSentAt: new Date() },
  });

  await prisma.bookingLog.create({
    data: {
      bookingId: booking.id,
      showId: session.showId,
      action: "TICKET_ISSUED",
      description: `Ticket issued: ${booking.bookingRef}`,
    },
  });

  updateSession(from, { step: "CONFIRMED" });

  const seatCodes = booking.seats.map((bs) => bs.seat.seatCode).join(", ");

  await sendWhatsAppMessage(
    from,
    `🎉 *Booking Confirmed!*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🎭 *${booking.show.title}*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📍 ${booking.show.venue}, ${booking.show.city}\n` +
      `📅 ${formatDate(booking.show.date)}\n` +
      `🕐 ${booking.show.time}\n\n` +
      `🎫 *Ticket Details:*\n` +
      `• Ref: *${booking.bookingRef}*\n` +
      `• Name: *${booking.bookerName}*\n` +
      `• Seats: *${seatCodes}*\n` +
      `• Amount Paid: *₹${booking.totalAmount.toLocaleString("en-IN")}*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `_Show this message + QR at the venue entrance._\n\n` +
      `To cancel your booking, type *CANCEL* anytime.`
  );

  await sendWhatsAppImage(
    from,
    qrImageUrl,
    `🎟️ *QR Ticket — ${booking.bookingRef}*\n\nPresent this at the entrance for verification.`
  );
};