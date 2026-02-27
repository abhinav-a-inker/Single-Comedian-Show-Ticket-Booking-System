import prisma from "../utils/prisma";

type ClientStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

export const getClientProfileService = async () => {
  const client = await prisma.client.findFirst({
    where: {
      status: "PENDING",
    },
    include: {
      login: { select: { email: true, createdAt: true } },
      _count: { select: { shows: true } },
    },
  });
  if (!client) throw new Error("No pending clients found");
  return client;
};

export const updateClientStatusService = async (
  action: "APPROVE" | "REJECT" | "SUSPEND" | "ACTIVATE"
) => {
  const client = await prisma.client.findFirst({
    where: { status: "PENDING" }, 
  });
  if (!client) throw new Error("No pending clients found");

  let status: ClientStatus;
  switch (action) {
    case "APPROVE":  status = "APPROVED";  break;
    case "REJECT":   status = "REJECTED";  break;
    case "SUSPEND":  status = "SUSPENDED"; break;
    case "ACTIVATE": status = "APPROVED";  break;
    default: throw new Error("Invalid action");
  }

  return await prisma.client.update({
    where: { id: client.id },
    data: { status },
    include: {
      login: { select: { email: true, createdAt: true } },
      _count: { select: { shows: true } },
    },
  });
};

export const getClientShowsService = async (clientId: string) => {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
  });
  if (!client) throw new Error("Client not found");

  return await prisma.show.findMany({
    where: { clientId },
    include: {
      seatCategories: true,
      _count: { select: { seats: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const deleteShowService = async (showId: string, clientId: string) => {
  const show = await prisma.show.findUnique({
    where: { id: showId },
  });
  if (!show) throw new Error("Show not found");
  if (show.clientId !== clientId) throw new Error("Unauthorized: show does not belong to this client");

  // Cascade delete: seatCategories → seats → show
  await prisma.seatCategory.deleteMany({
    where: { showId },
  });

  return await prisma.show.delete({
    where: { id: showId },
  });
};

export const getShowBookingsService = async (
  showId: string,
  seatStatus?: string,
  search?: string
) => {
  return await prisma.seat.findMany({
    where: {
      showId,
      ...(seatStatus && seatStatus !== "ALL" && { status: seatStatus as any }),
    },
    include: {
      category: { select: { name: true, price: true } },
      show: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};