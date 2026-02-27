import prisma from "../utils/prisma";
import QRCode from "qrcode";
import { randomBytes } from "crypto"; 

interface Category {
  name: string;
  color: string;
  price: number;
  fromRow: string;
  toRow: string;
  earlyBirdPrice?: number;
  earlyBirdDeadline?: string;
}

interface CreateShowInput {
  title: string;
  description?: string;
  venue: string;
  city: string;
  state: string;
  country: string;
  date: string;
  time: string;
  totalRows: number;
  totalCols: number;
  arrangementType: "FRONT_TO_BACK" | "BACK_TO_FRONT" | "EQUAL";
  cancellationAllowed?: boolean;
  refundSlabs?: object[];
  categories: Category[];
  blockedSeats?: string[];
  posterImage?: string;
}

// ─── CREATE ───────────────────────────────────────────────────────────────────
export const createShowService = async (loginId: string, data: CreateShowInput) => {
  if (!data.categories || data.categories.length === 0) {
    throw new Error("At least one seat category is required");
  }

  const totalSeats = data.totalRows * data.totalCols;

  // ✅ CHANGED: unique random keyword instead of timestamp
  const whatsappKeyword = `SHOW_${randomBytes(4).toString("hex").toUpperCase()}`;

  const rowLabels = Array.from({ length: data.totalRows }, (_, i) =>
    String.fromCharCode(65 + i)
  );

  const seatsToCreate: {
    rowLabel: string;
    seatNumber: number;
    seatCode: string;
    isBlocked: boolean;
    categoryName: string;
  }[] = [];

  rowLabels.forEach((row) => {
    for (let col = 1; col <= data.totalCols; col++) {
      const seatCode = `${row}${col}`;
      const category = data.categories.find((cat) => {
        const from = cat.fromRow.toUpperCase();
        const to = cat.toRow.toUpperCase();
        return row >= from && row <= to;
      });
      seatsToCreate.push({
        rowLabel: row,
        seatNumber: col,
        seatCode,
        isBlocked: data.blockedSeats?.includes(seatCode) || false,
        categoryName: category?.name || data.categories[0]!.name,
      });
    }
  });

  const phoneNumber = process.env.WHATSAPP_BUSINESS_PHONE;
  const qrContent = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(whatsappKeyword)}`;
  const qrCode = await QRCode.toDataURL(qrContent, {
    width: 400,
    margin: 2,
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  const newShow = await prisma.show.create({
    data: {
      loginId,
      title: data.title,
      description: data.description ?? null,
      venue: data.venue,
      city: data.city,
      state: data.state,
      country: data.country,
      date: new Date(data.date),
      time: data.time,
      totalRows: data.totalRows,
      totalCols: data.totalCols,
      totalSeats,
      arrangementType: data.arrangementType,
      whatsappKeyword,
      qrCode,
      posterImage: data.posterImage ?? null,
      cancellationAllowed: data.cancellationAllowed ?? true,
      refundSlabs: data.refundSlabs ?? [],
    },
  });

  const createdCategories = await Promise.all(
    data.categories.map((cat) =>
      prisma.seatCategory.create({
        data: {
          showId: newShow.id,
          name: cat.name,
          color: cat.color,
          price: cat.price,
          fromRow: cat.fromRow.toUpperCase(),
          toRow: cat.toRow.toUpperCase(),
          earlyBirdPrice: cat.earlyBirdPrice ?? null,
          earlyBirdDeadline: cat.earlyBirdDeadline
            ? new Date(cat.earlyBirdDeadline)
            : null,
        },
      })
    )
  );

  const categoryMap: Record<string, string> = {};
  createdCategories.forEach((c) => { categoryMap[c.name] = c.id; });

  const CHUNK_SIZE = 50;
  for (let i = 0; i < seatsToCreate.length; i += CHUNK_SIZE) {
    const chunk = seatsToCreate.slice(i, i + CHUNK_SIZE);
    await prisma.seat.createMany({
      data: chunk.map((seat) => {
        const categoryId = categoryMap[seat.categoryName];
        if (!categoryId) throw new Error(`Category not found: ${seat.categoryName}`);
        return {
          showId: newShow.id,
          categoryId,
          rowLabel: seat.rowLabel,
          seatNumber: seat.seatNumber,
          seatCode: seat.seatCode,
          isBlocked: seat.isBlocked,
          status: seat.isBlocked ? "BLOCKED" : "AVAILABLE",
        };
      }),
    });
  }

  return newShow;
};

// ─── GET ALL ──────────────────────────────────────────────────────────────────
export const getMyShowsService = async (loginId: string, role: string) => {
  const where = role === "ADMIN" ? {} : { loginId };
  return await prisma.show.findMany({
    where,
    include: {
      seatCategories: true,
      _count: { select: { seats: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

// ─── GET BY ID ────────────────────────────────────────────────────────────────
export const getShowByIdService = async (showId: string, loginId: string, role: string) => {
  const where = role === "ADMIN" ? { id: showId } : { id: showId, loginId };

  const show = await prisma.show.findFirst({
    where,
    include: {
      seatCategories: true,
      seats: true,
      _count: { select: { seats: true } },
    },
  });
  if (!show) throw new Error("Show not found");
  return show;
};

// ─── UPDATE ───────────────────────────────────────────────────────────────────
export const updateShowService = async (
  showId: string, loginId: string, role: string, data: any
) => {
  const where = role === "ADMIN" ? { id: showId } : { id: showId, loginId };
  const show = await prisma.show.findFirst({ where });
  if (!show) throw new Error("Show not found");

  return await prisma.show.update({
    where: { id: showId },
    data: {
      ...(data.title && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.venue && { venue: data.venue }),
      ...(data.city && { city: data.city }),
      ...(data.state && { state: data.state }),
      ...(data.country && { country: data.country }),
      ...(data.date && { date: new Date(data.date) }),
      ...(data.time && { time: data.time }),
      ...(data.status && { status: data.status }),
      ...(data.cancellationAllowed !== undefined && { cancellationAllowed: data.cancellationAllowed }),
      ...(data.refundSlabs && { refundSlabs: data.refundSlabs }),
      ...(data.posterImage !== undefined && { posterImage: data.posterImage }),
    },
  });
};

// ─── DELETE ───────────────────────────────────────────────────────────────────
export const deleteShowService = async (showId: string, loginId: string, role: string) => {
  const where = role === "ADMIN" ? { id: showId } : { id: showId, loginId };
  const show = await prisma.show.findFirst({ where });
  if (!show) throw new Error("Show not found");

  // Must delete in dependency order — child records first, parent last.
  // This is required because Booking, Transaction, etc. all have onDelete: NoAction
  // which means the DB refuses to delete the Show while related rows exist.

  // 1. Transactions (depend on Booking)
  await prisma.transaction.deleteMany({
    where: { booking: { showId } },
  });

  // 2. Ticket scans (depend on Booking)
  await prisma.ticketScan.deleteMany({
    where: { booking: { showId } },
  });

  // 3. Cancellations (depend on Booking)
  await prisma.cancellation.deleteMany({
    where: { booking: { showId } },
  });

  // 4. Booking logs that reference this show directly
  await prisma.bookingLog.deleteMany({
    where: { showId },
  });

  // 5. BookingSeats (depend on Booking)
  await prisma.bookingSeat.deleteMany({
    where: { booking: { showId } },
  });

  // 6. Bookings themselves
  await prisma.booking.deleteMany({
    where: { showId },
  });

  // 7. Delete the show — Seat and SeatCategory cascade automatically
  //    because they have onDelete: Cascade in the schema
  await prisma.show.delete({
    where: { id: showId },
  });
};
