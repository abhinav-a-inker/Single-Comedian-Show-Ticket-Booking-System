import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getClientShowsApi, getShowBookingsApi } from "../../services/admin.api";
import type { Show, Booking } from "../../types/admin.types";
const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const STATUS_COLOR: Record<string, string> = { CONFIRMED: "#00D4A1", PENDING: "#FFB347", CANCELLED: "#FF5555", SUCCESS: "#00D4A1", REFUNDED: "#888", FAILED: "#FF5555" };

const Badge = ({ status }: { status: string }) => (
  <span style={{ padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700, background: `${STATUS_COLOR[status] || "#888"}22`, color: STATUS_COLOR[status] || "#888", textTransform: "uppercase" }}>{status}</span>
);

const Bookings = () => {
  const [searchParams] = useSearchParams();
  const [shows, setShows] = useState<Show[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedShowId, setSelectedShowId] = useState<string>(searchParams.get("showId") || "");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getClientShowsApi()
      .then((r) => setShows(r.data.data))
      .catch((err) => setError(err.response?.data?.message || "Failed to load shows"));
  }, []);

  useEffect(() => {
    if (!selectedShowId) return;
    setLoading(true);
    getShowBookingsApi(selectedShowId, statusFilter, search)
      .then((r) => setBookings(r.data.data))
      .finally(() => setLoading(false));
  }, [selectedShowId, statusFilter, search]);

  if (error || shows.length === 0) {
    return (
      <div>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: "#6C63FF", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Booking Management</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#E8E8F0", letterSpacing: "-0.02em" }}>Bookings</h1>
        </div>
        <div style={{ background: "#16161E", border: "1px solid #23232F", borderRadius: 14, padding: 40, textAlign: "center", color: "#555" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#E8E8F0", marginBottom: 8 }}>No bookings available</div>
          <div style={{ fontSize: 14, color: "#666" }}>There are no shows to display bookings for. {error && `Error: ${error}`}</div>
        </div>
      </div>
    );
  }

  const totalRevenue = bookings.filter(b => b.status === "CONFIRMED").reduce((s, b) => s + b.totalAmount, 0);
  const totalCommission = bookings.filter(b => b.status === "CONFIRMED").reduce((s, b) => s + (b.transaction?.commissionAmt || 0), 0);

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: "#6C63FF", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Booking Management</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#E8E8F0", letterSpacing: "-0.02em" }}>Bookings</h1>
      </div>

      {/* Show selector */}
      <div style={{ background: "#16161E", border: "1px solid #23232F", borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Select Show</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {shows.map((show) => (
            <div key={show.id} onClick={() => setSelectedShowId(show.id)} style={{ padding: "8px 16px", borderRadius: 100, fontSize: 13, fontWeight: 500, cursor: "pointer", background: selectedShowId === show.id ? "#6C63FF" : "transparent", color: selectedShowId === show.id ? "#fff" : "#555", border: `1px solid ${selectedShowId === show.id ? "#6C63FF" : "#2A2A38"}`, transition: "all 0.15s" }}>
              {show.title}
            </div>
          ))}
        </div>
      </div>

      {selectedShowId && (
        <>
          {/* Filters */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <input placeholder="Search name, phone, email..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, background: "#16161E", border: "1px solid #23232F", borderRadius: 10, color: "#E8E8F0", padding: "11px 16px", fontSize: 14, outline: "none", fontFamily: "DM Sans" }} />
            {["ALL", "CONFIRMED", "PENDING", "CANCELLED"].map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: "11px 16px", borderRadius: 10, background: statusFilter === s ? "#6C63FF" : "transparent", border: `1px solid ${statusFilter === s ? "#6C63FF" : "#23232F"}`, color: statusFilter === s ? "#fff" : "#555", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {s}
              </button>
            ))}
          </div>

          {/* Summary */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Total", value: bookings.length, color: "#E8E8F0" },
              { label: "Confirmed", value: bookings.filter(b => b.status === "CONFIRMED").length, color: "#00D4A1" },
              { label: "Cancelled", value: bookings.filter(b => b.status === "CANCELLED").length, color: "#FF5555" },
              { label: "Revenue", value: `₹${totalRevenue.toLocaleString()}`, color: "#00D4A1" },
              { label: "Commission", value: `₹${totalCommission.toLocaleString()}`, color: "#FFB347" },
            ].map((s) => (
              <div key={s.label} style={{ flex: 1, background: "#16161E", border: "1px solid #23232F", borderRadius: 10, padding: "12px 16px" }}>
                <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
                <div style={{ fontFamily: "Space Mono", fontSize: 16, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div style={{ background: "#16161E", border: "1px solid #23232F", borderRadius: 14, overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: "#555" }}>Loading bookings...</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1A1A24", background: "#0D0D11" }}>
                    {["User", "Contact", "Seats", "Amount", "Payment", "Status", "Date"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, color: "#444", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking, i) => (
                    <tr key={booking.id} style={{ borderBottom: i < bookings.length - 1 ? "1px solid #1A1A2444" : "none" }}>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#E8E8F0" }}>{booking.endUser.fullName}</div>
                        <div style={{ fontSize: 12, color: "#555" }}>{booking.ticketCount} ticket{booking.ticketCount > 1 ? "s" : ""}</div>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: 13, color: "#666" }}>{booking.endUser.phone}</div>
                        <div style={{ fontSize: 12, color: "#555" }}>{booking.endUser.email}</div>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {booking.seats.map((s) => (
                            <span key={s.seatCode} style={{ padding: "2px 8px", background: "#6C63FF22", borderRadius: 4, fontSize: 11, color: "#6C63FF", fontFamily: "Space Mono" }}>{s.seatCode}</span>
                          ))}
                        </div>
                        <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>{booking.seats[0]?.category.name}</div>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontFamily: "Space Mono", fontSize: 14, color: "#00D4A1" }}>₹{booking.totalAmount.toLocaleString()}</div>
                        {booking.transaction && <div style={{ fontSize: 11, color: "#555" }}>via {booking.transaction.gateway}</div>}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {booking.transaction && (
                          <>
                            <Badge status={booking.transaction.status} />
                            {booking.transaction.commissionAmt > 0 && <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>Comm: ₹{booking.transaction.commissionAmt}</div>}
                          </>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px" }}><Badge status={booking.status} /></td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: 12, fontFamily: "Space Mono", color: "#555" }}>{fmt(booking.createdAt)}</div>
                      </td>
                    </tr>
                  ))}
                  {bookings.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#444" }}>No bookings found</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {!selectedShowId && (
        <div style={{ padding: 60, textAlign: "center", color: "#444", background: "#16161E", borderRadius: 14, border: "1px solid #23232F" }}>
          ← Select a show above to view its bookings
        </div>
      )}
    </div>
  );
};

export default Bookings;