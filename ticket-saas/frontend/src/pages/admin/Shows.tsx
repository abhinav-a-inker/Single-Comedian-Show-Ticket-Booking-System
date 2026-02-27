import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getClientShowsApi } from "../../services/admin.api";
import type { Show } from "../../types/admin.types";

const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const STATUS_COLOR: Record<string, string> = { PUBLISHED: "#00D4A1", DRAFT: "#888", CANCELLED: "#FF5555", COMPLETED: "#6C63FF" };

const Shows = () => {
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    getClientShowsApi()
      .then((r) => setShows(r.data.data))
      .catch((err) => setError(err.response?.data?.message || "Failed to load shows"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: "#555", padding: 40 }}>Loading...</div>;

  if (error || shows.length === 0) {
    return (
      <div>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: "#6C63FF", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Comedian Shows</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#E8E8F0", letterSpacing: "-0.02em" }}>All Shows</h1>
        </div>
        <div style={{ background: "#16161E", border: "1px solid #23232F", borderRadius: 14, padding: 40, textAlign: "center", color: "#555" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#E8E8F0", marginBottom: 8 }}>No shows available</div>
          <div style={{ fontSize: 14, color: "#666" }}>There are no shows to display. {error && `Error: ${error}`}</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: "#6C63FF", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Comedian Shows</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#E8E8F0", letterSpacing: "-0.02em" }}>All Shows</h1>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {shows.map((show) => {
          const occupancy = show._count.seats > 0 ? Math.round((show._count.bookings / show._count.seats) * 100) : 0;
          return (
            <div key={show.id} style={{ background: "#16161E", border: "1px solid #23232F", borderRadius: 14, padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: "#E8E8F0" }}>{show.title}</h3>
                    <span style={{ padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700, background: `${STATUS_COLOR[show.status]}22`, color: STATUS_COLOR[show.status] }}>{show.status}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#555" }}>{show.venue} · {show.city} · {fmt(show.date)}</div>
                </div>
                <button onClick={() => navigate(`/admin/bookings?showId=${show.id}`)} style={{ padding: "9px 18px", borderRadius: 10, background: "#6C63FF11", border: "1px solid #6C63FF33", color: "#6C63FF", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  View Bookings →
                </button>
              </div>

              <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
                {show.seatCategories.map((cat) => (
                  <span key={cat.name} style={{ fontSize: 13, color: "#666" }}>{cat.name}: <span style={{ color: "#888" }}>₹{cat.price.toLocaleString()}</span></span>
                ))}
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "#555" }}>Occupancy</span>
                  <span style={{ fontSize: 12, fontFamily: "Space Mono", color: "#666" }}>{show._count.bookings}/{show._count.seats}</span>
                </div>
                <div style={{ background: "#0F0F13", borderRadius: 100, height: 6 }}>
                  <div style={{ height: "100%", width: `${occupancy}%`, background: occupancy > 80 ? "#00D4A1" : occupancy > 50 ? "#FFB347" : "#6C63FF", borderRadius: 100 }} />
                </div>
                <div style={{ fontSize: 11, color: "#444", marginTop: 4 }}>{occupancy}% booked</div>
              </div>
            </div>
          );
        })}
        {shows.length === 0 && <div style={{ color: "#444", padding: 40, textAlign: "center" }}>No shows found</div>}
      </div>
    </div>
  );
};

export default Shows;