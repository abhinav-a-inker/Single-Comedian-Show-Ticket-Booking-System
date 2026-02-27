import { Request, Response } from "express";
import {
  sendWhatsAppMessage,
  sendWhatsAppButtons,
} from "../services/whatsapp.service";
import { getSession, setSession, updateSession, deleteSession } from "../whatsapp/session.store";
import { handleKeywordTrigger, handleBookNow, handleCollectDetails, handleCategorySelected, handleQuantitySelected, handleSeatSelected, handleSeatsClear, handleSeatsDone, handleConfirmPayment } from "../whatsapp/booking.handler";
import { handleCancelIntent, handleCancelFull, handleCancelPartialStart, handleCancelSeatToggle, handleCancelClearTicks, handleConfirmCancellation } from "../whatsapp/cancellation.handler";
// ─── Helpers ──────────────────────────────────────────────────────────────────

const getInteractiveReply = (message: any): string | null => {
  if (message.type === "interactive") {
    return (
      message.interactive?.button_reply?.id ||
      message.interactive?.list_reply?.id ||
      null
    );
  }
  return null;
};

// ─── Deduplication store ──────────────────────────────────────────────────────
// WhatsApp may deliver the same message twice within a few seconds.
// Track processed message IDs for 60 seconds to skip duplicates.
const processedMessageIds = new Map<string, number>();

const isDuplicate = (messageId: string): boolean => {
  const now = Date.now();
  // Purge entries older than 60 seconds
  for (const [id, ts] of processedMessageIds.entries()) {
    if (now - ts > 60_000) processedMessageIds.delete(id);
  }
  if (processedMessageIds.has(messageId)) return true;
  processedMessageIds.set(messageId, now);
  return false;
};

// ─── Meta verification ────────────────────────────────────────────────────────
export const verifyWebhook = (req: Request, res: Response): void => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("[Webhook] ✅ Verified");
    res.status(200).send(challenge);
  } else {
    console.log("[Webhook] ❌ Failed verification");
    res.status(403).send("Forbidden");
  }
};

// ─── Main webhook handler ─────────────────────────────────────────────────────
export const handleWhatsAppWebhook = async (
  req: Request,
  res: Response
): Promise<void> => {
  // Always ACK immediately — prevents WhatsApp 20-second timeout + retries
  res.sendStatus(200);

  try {
    const body = req.body;

    if (body.object !== "whatsapp_business_account") return;

    const messages = body.entry?.[0]?.changes?.[0]?.value?.messages;
    if (!messages?.length) return;

    const message = messages[0];

    // ── Deduplication — skip if we've already processed this message ID ──
    if (message.id && isDuplicate(message.id)) {
      console.log(`[WhatsApp] ⚠️ Duplicate message skipped: ${message.id}`);
      return;
    }

    const from: string = message.from;
    const text: string | undefined = message.text?.body?.trim();
    const textUpper = text?.toUpperCase();
    const interactiveId: string | null = getInteractiveReply(message);

    console.log(
      `[WhatsApp] From: ${from} | Text: "${text}" | Interactive: "${interactiveId}" | MsgID: ${message.id}`
    );

    const session = getSession(from);

    // ═══════════════════════════════════════════════════════════════════════
    // ROUTING — evaluated top-to-bottom; first match wins
    // ═══════════════════════════════════════════════════════════════════════

    // ── Keyword trigger (always processed even if session exists) ──────────
    // SHOW_XXXX keyword resets and starts fresh
    if (textUpper?.startsWith("SHOW_")) {
      await handleKeywordTrigger(from, textUpper);
      return;
    }

    // ── No session — nothing to do ─────────────────────────────────────────
    if (!session) {
      await sendWhatsAppMessage(
        from,
        `👋 Please scan the show QR code to begin booking.`
      );
      return;
    }

    // ── Global CANCEL (pre-payment) — released locked seats + deletes session
    if (
      textUpper === "CANCEL" &&
      session.step !== "CONFIRMED" &&
      session.step !== "AWAITING_CANCEL_TYPE" &&
      session.step !== "AWAITING_CANCEL_SEATS"
    ) {
      await handlePrePaymentCancel(from, session);
      return;
    }

    // ── Post-confirmation CANCEL — enters the cancellation flow ───────────
    if (textUpper === "CANCEL" && session.step === "CONFIRMED") {
      await handleCancelIntent(from, session);
      return;
    }

    // ─────────────────────────────────────────────────────────────────────
    // BOOKING FLOW
    // ─────────────────────────────────────────────────────────────────────

    if (interactiveId === "BOOK_NOW" && session.step === "SHOW_DETAILS") {
      await handleBookNow(from);
      return;
    }

    if (
      session.step === "COLLECTING_DETAILS" &&
      session.quantity === undefined &&
      text?.includes("\n")
    ) {
      await handleCollectDetails(from, session, text);
      return;
    }

    if (
      interactiveId?.startsWith("CAT_") &&
      session.step === "SELECTING_CATEGORY"
    ) {
      await handleCategorySelected(from, session, interactiveId);
      return;
    }

    if (
      interactiveId?.startsWith("QTY_") &&
      session.step === "SELECTING_QUANTITY"
    ) {
      await handleQuantitySelected(from, session, interactiveId);
      return;
    }

    if (
      interactiveId?.startsWith("SEAT_") &&
      session.step === "SELECTING_SEATS"
    ) {
      await handleSeatSelected(from, session, interactiveId);
      return;
    }

    if (interactiveId === "SEATS_DONE" && session.step === "SELECTING_SEATS") {
      await handleSeatsDone(from, session);
      return;
    }

    if (
      interactiveId === "SEATS_CLEAR" &&
      session.step === "SELECTING_SEATS"
    ) {
      await handleSeatsClear(from, session);
      return;
    }

    if (
      interactiveId === "CONFIRM_PAYMENT" &&
      session.step === "AWAITING_PAYMENT"
    ) {
      await handleConfirmPayment(from, session);
      return;
    }

    // ─────────────────────────────────────────────────────────────────────
    // CANCELLATION FLOW
    // ─────────────────────────────────────────────────────────────────────

    if (
      interactiveId === "CANCEL_FULL" &&
      session.step === "AWAITING_CANCEL_TYPE"
    ) {
      await handleCancelFull(from, session);
      return;
    }

    if (
      interactiveId === "CANCEL_PARTIAL" &&
      session.step === "AWAITING_CANCEL_TYPE"
    ) {
      await handleCancelPartialStart(from, session);
      return;
    }

    if (
      interactiveId?.startsWith("CXSEAT_") &&
      session.step === "AWAITING_CANCEL_SEATS"
    ) {
      await handleCancelSeatToggle(from, session, interactiveId);
      return;
    }

    if (
      interactiveId === "CANCEL_CLEAR_TICKS" &&
      session.step === "AWAITING_CANCEL_SEATS"
    ) {
      await handleCancelClearTicks(from, session);
      return;
    }

    if (
      interactiveId === "CONFIRM_CANCEL" &&
      session.step === "AWAITING_CANCEL_SEATS"
    ) {
      await handleConfirmCancellation(from, session);
      return;
    }

    // ─────────────────────────────────────────────────────────────────────
    // FALLBACK
    // ─────────────────────────────────────────────────────────────────────

    await sendWhatsAppButtons(
      from,
      `❓ I didn't understand that.\n\nWhat would you like to do?`,
      [
        { id: "BOOK_NOW", title: "🔄 Start Over" },
        { id: "CANCEL", title: "❌ Cancel" },
      ]
    );
  } catch (err: any) {
    console.error("[WhatsApp] ❌ ERROR:", err.message);
    console.error("[WhatsApp] ❌ STACK:", err.stack);
    // Do not re-throw — res.sendStatus(200) already sent
  }
};

// ─── Pre-payment global cancel ────────────────────────────────────────────────
async function handlePrePaymentCancel(
  from: string,
  session: ReturnType<typeof getSession> & {}
): Promise<void> {
  // Import prisma here to avoid circular deps (or move to a shared utils file)
  const { default: prisma } = await import("../utils/prisma");

  if (session.bookingId) {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: session.bookingId },
        include: { seats: true },
      });
      if (booking && !["CONFIRMED", "CANCELLED", "EXPIRED"].includes(booking.status)) {
        await prisma.seat.updateMany({
          where: { id: { in: booking.seats.map((bs) => bs.seatId) } },
          data: { status: "AVAILABLE", lockedUntil: null },
        });
        await prisma.booking.update({
          where: { id: session.bookingId },
          data: { status: "CANCELLED" },
        });
        await prisma.bookingLog.create({
          data: {
            bookingId: session.bookingId,
            showId: session.showId,
            action: "BOOKING_CANCELLED",
            description: "User typed CANCEL before payment",
          },
        });
      }
    } catch (e) {
      console.error("[Cancel] Failed to release booking:", e);
    }
  }

  deleteSession(from);

  await sendWhatsAppMessage(
    from,
    `❌ *Booking cancelled.*\n\nScan the QR code at the venue to start a new booking.`
  );
}