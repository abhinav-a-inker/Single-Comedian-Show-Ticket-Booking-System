export type Client = {
  id: string;
  fullName: string;
  companyName: string;
  phone: string;
  contactEmail: string;
  city: string;
  state: string;
  country: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  login: { email: string; createdAt: string };
  _count: { shows: number };
};

export type Show = {
  id: string;
  title: string;
  venue: string;
  city: string;
  date: string;
  status: string;
  seatCategories: { name: string; price: number }[];
  _count: { bookings: number; seats: number };
};

export type Booking = {
  id: string;
  status: string;
  ticketCount: number;
  totalAmount: number;
  createdAt: string;
  endUser: { fullName: string; phone: string; email: string };
  seats: { seatCode: string; category: { name: string; price: number } }[];
  transaction: {
    amount: number;
    commissionAmt: number;
    netAmount: number;
    status: string;
    paidAt: string | null;
    gateway: string;
  } | null;
};