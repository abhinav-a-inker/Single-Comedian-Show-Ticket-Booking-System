// ─── Session Types ────────────────────────────────────────────────────────────

export type SessionStep =
  | "SHOW_DETAILS"
  | "COLLECTING_DETAILS"
  | "SELECTING_CATEGORY"
  | "SELECTING_QUANTITY"
  | "SELECTING_SEATS"
  | "AWAITING_PAYMENT"
  | "CONFIRMED"
  | "AWAITING_CANCEL_TYPE"
  | "AWAITING_CANCEL_SEATS";

export interface Session {
  step: SessionStep;
  showId: string;
  keyword: string;
  // Collected user details
  name?: string;
  age?: number;
  email?: string;
  // Booking selections
  categoryId?: string;
  quantity?: number;
  selectedSeats?: string[];
  bookingId?: string;
  // Cancellation sub-flow
  cancelBookingId?: string;
  cancelableSeats?: string[];
  selectedCancelSeats?: string[];
}

// ─── In-memory store ──────────────────────────────────────────────────────────
// Replace with Redis (ioredis) in production for multi-instance deployments:
//   await redis.set(`wa:session:${phone}`, JSON.stringify(session), "EX", 3600)
//   const raw = await redis.get(`wa:session:${phone}`)
//   const session: Session | null = raw ? JSON.parse(raw) : null

const store: Record<string, Session> = {};

export const getSession = (phone: string): Session | undefined => store[phone];

export const setSession = (phone: string, session: Session): void => {
  store[phone] = session;
};

export const updateSession = (
  phone: string,
  patch: Partial<Session>
): Session | undefined => {
  if (!store[phone]) return undefined;
  store[phone] = { ...store[phone], ...patch };
  return store[phone];
};

export const deleteSession = (phone: string): void => {
  delete store[phone];
};