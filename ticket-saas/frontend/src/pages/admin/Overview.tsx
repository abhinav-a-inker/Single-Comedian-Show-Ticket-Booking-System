import { useEffect, useState } from "react";
import { getClientProfileApi, getClientShowsApi } from "../../services/admin.api";
import type { Client, Show } from "../../types/admin.types";

const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const STATUS_COLOR: Record<string, string> = { PUBLISHED: "#00D4A1", DRAFT: "#888", CANCELLED: "#FF5555", COMPLETED: "#6C63FF" };

const Overview = () => {
  const [client, setClient] = useState<Client | null>(null);
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getClientProfileApi(), getClientShowsApi()])
      .then(([c, s]) => { setClient(c.data.data); setShows(s.data.data); })
      .catch((err) => setError(err.response?.data?.message || "Failed to load data"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: "#555", padding: 40 }}>Loading...</div>;

  if (error || !client) {
    return (
      <div style={{ padding: 40 }}>
        <div style={{ fontSize: 11, color: "#6C63FF", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Dashboard</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#E8E8F0", letterSpacing: "-0.02em", marginBottom: 28 }}>Overview</h1>
        <div style={{ background: "#16161E", border: "1px solid #23232F", borderRadius: 14, padding: 32, textAlign: "center", color: "#555" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#E8E8F0", marginBottom: 8 }}>No pending clients</div>
          <div style={{ fontSize: 14, color: "#666" }}>There are no pending comedian accounts to review at this time.</div>
        </div>
      </div>
    );
  }

  const totalBookings = shows.reduce((s, sh) => s + sh._count.bookings, 0);

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: "#6C63FF", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Dashboard</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#E8E8F0", letterSpacing: "-0.02em" }}>Overview</h1>
      </div>

      {client && client.status === "PENDING" && (

        <div style={{ background: "#FFB34711", border: "1px solid #FFB34733", borderRadius: 12, padding: "14px 20px", marginBottom: 24, color: "#FFB347", fontSize: 14 }}>
          ⚠ Comedian account is <strong>pending approval</strong>. Go to Comedian tab to approve.
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "flex", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Total Shows", value: shows.length, accent: "#6C63FF" },
          { label: "Total Bookings", value: totalBookings, accent: "#E8E8F0" },
          { label: "Published", value: shows.filter(s => s.status === "PUBLISHED").length, accent: "#00D4A1" },
        ].map((s) => (
          <div key={s.label} style={{ flex: 1, background: "#16161E", border: "1px solid #23232F", borderRadius: 14, padding: "20px 24px" }}>
            <div style={{ fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.accent, fontFamily: "Space Mono" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Shows table */}
      <div style={{ background: "#16161E", border: "1px solid #23232F", borderRadius: 14, padding: 24 }}>
        <div style={{ fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Recent Shows</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1A1A24" }}>
              {["Show", "Venue", "Date", "Bookings", "Status"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, color: "#444", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shows.map((show) => (
              <tr key={show.id} style={{ borderBottom: "1px solid #1A1A2444" }}>
                <td style={{ padding: "12px", fontSize: 14, fontWeight: 600, color: "#E8E8F0" }}>{show.title}</td>
                <td style={{ padding: "12px", fontSize: 13, color: "#666" }}>{show.venue}, {show.city}</td>
                <td style={{ padding: "12px", fontSize: 13, color: "#666", fontFamily: "Space Mono" }}>{fmt(show.date)}</td>
                <td style={{ padding: "12px", fontSize: 13, color: "#888" }}>{show._count.bookings}/{show._count.seats}</td>
                <td style={{ padding: "12px" }}>
                  <span style={{ padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700, background: `${STATUS_COLOR[show.status]}22`, color: STATUS_COLOR[show.status] }}>{show.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Overview;