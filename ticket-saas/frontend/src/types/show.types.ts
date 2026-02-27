export type ShowStatus = "DRAFT" | "PUBLISHED" | "CANCELLED" | "COMPLETED";
export type ArrangementType = "FRONT_TO_BACK" | "BACK_TO_FRONT" | "EQUAL";

export type Category = {
  name: string;
  color: string;
  price: number;
  fromRow: string;
  toRow: string;
  earlyBirdPrice?: number;
  earlyBirdDeadline?: string;
};

export type Show = {
  id: string;
  title: string;
  description?: string;
  venue: string;
  city: string;
  state: string;
  country: string;
  date: string;
  time: string;
  status: ShowStatus;
  qrCode?: string;
  whatsappKeyword: string;
  totalRows: number;
  totalCols: number;
  totalSeats: number;
  arrangementType: ArrangementType;
  cancellationAllowed: boolean;
  refundSlabs: object[];
  seatCategories: Category[];
  _count: { bookings: number; seats: number };
  createdAt: string;
};