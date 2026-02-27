import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format } from "date-fns";

// ── TYPES ──────────────────────────────────────────────────────────────────────

interface OverviewStats {
  totalShows: number;
  activeShows: number;
  totalBookings: number;
  confirmedBookings: number;
  totalRevenue: number;
  pendingRefunds: number;
  totalSeatsBooked: number;
  avgOccupancy: number;
}

interface RevenuePoint {
  date: string;
  revenue: number;
  bookings: number;
}

interface BookingStatusDist {
  status: string;
  count: number;
}

interface ShowPerformance {
  title: string;
  booked: number;
  capacity: number;
  revenue: number;
}

interface RecentLog {
  id: string;
  action: string;
  description: string | null;
  createdAt: string;
  bookingRef?: string;
}

interface OverviewData {
  stats: OverviewStats;
  revenueChart: RevenuePoint[];
  bookingStatusDist: BookingStatusDist[];
  topShows: ShowPerformance[];
  recentLogs: RecentLog[];
}

// ── PALETTE ────────────────────────────────────────────────────────────────────

const C = {
  bg: "#F5F4F0",
  surface: "#FFFFFF",
  border: "#E8E6E1",
  grid: "#F0EEE9",
  ink: "#1A1A18",
  ink2: "#4A4A46",
  ink3: "#8A8A84",
  accent: "#1A1A18",
  accent2: "#5A5A54",
  accent3: "#B0AFA8",
  fill1: "#1A1A18",
  fill2: "#5A5A54",
  fill3: "#9A9A94",
  fill4: "#CACAC4",
  tag: "#ECEAE4",
};

const ACTION_ICONS: Record<string, string> = {
  BOOKING_STARTED: "🎟",
  DETAILS_COLLECTED: "📋",
  SEATS_LOCKED: "🔒",
  SEATS_RELEASED: "🔓",
  PAYMENT_INITIATED: "💳",
  PAYMENT_SUCCESS: "✅",
  PAYMENT_FAILED: "❌",
  TICKET_ISSUED: "🎫",
  TICKET_SENT: "📨",
  TICKET_SCANNED: "📱",
  BOOKING_CANCELLED: "🚫",
  BOOKING_EXPIRED: "⏰",
  REFUND_INITIATED: "↩️",
  REFUND_PROCESSED: "💸",
};

// ── SUB-COMPONENTS ─────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: "14px 16px",
    }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: 0.8 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.ink, margin: "5px 0 3px", fontFamily: "'Courier New', monospace" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: C.ink3 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
      {children}
    </div>
  );
}

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, padding: "9px 13px", fontSize: 12 }}>
      <div style={{ fontWeight: 600, color: C.ink, marginBottom: 5 }}>{label}</div>
      {payload.map((e: any, i: number) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 16, color: C.ink2 }}>
          <span style={{ color: C.ink3 }}>{e.name}</span>
          <strong>{e.name?.toLowerCase().includes("revenue") ? `₹${e.value.toLocaleString()}` : e.value}{e.name?.toLowerCase().includes("occupancy") ? "%" : ""}</strong>
        </div>
      ))}
    </div>
  );
}

// ── MAIN ───────────────────────────────────────────────────────────────────────

export default function OverviewDashboard() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const res = await fetch("/api/overview", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        if (!res.ok) throw new Error("Failed");
        setData(await res.json());
      } catch {
        setError("Failed to load overview data");
      } finally {
        setLoading(false);
      }
    };
    fetchOverview();
  }, []);

  if (loading) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, color: C.ink3, fontSize: 14 }}>
      Loading…
    </div>
  );

  if (error || !data) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, color: C.ink, fontSize: 14 }}>
      {error ?? "No data"}
    </div>
  );

  const { stats, revenueChart, bookingStatusDist, topShows, recentLogs } = data;
  const topShowsWithOcc = topShows.map(s => ({
    ...s,
    occupancy: s.capacity > 0 ? Math.round((s.booked / s.capacity) * 100) : 0,
  }));
  const role = (localStorage.getItem("role") as string) ?? "CLIENT";

  return (
    <div style={{
      height: "100vh",
      overflow: "hidden",
      background: C.bg,
      fontFamily: "'Georgia', 'Times New Roman', serif",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* ── TOPBAR ── */}
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 24px",
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: C.ink, letterSpacing: -0.3 }}>Overview</span>
          <span style={{ fontSize: 12, color: C.ink3 }}>{format(new Date(), "EEE, d MMM yyyy")}</span>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 600, color: C.ink2,
          background: C.tag, padding: "3px 10px", borderRadius: 6, letterSpacing: 0.5,
        }}>{role}</span>
      </header>

      {/* ── BODY: 2/3 | 1/3 ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* LEFT — 2/3 */}
        <div style={{
          flex: "0 0 66.66%",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          padding: "16px 12px 16px 20px",
          overflow: "hidden",
        }}>

          {/* STAT CARDS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, flexShrink: 0 }}>
            <StatCard
              label="Revenue"
              value={`₹${(stats.totalRevenue / 1000).toFixed(1)}k`}
              sub={`${stats.confirmedBookings} confirmed`}
            />
            <StatCard
              label="Bookings"
              value={stats.totalBookings.toLocaleString()}
              sub={`${stats.totalSeatsBooked.toLocaleString()} seats`}
            />
            <StatCard
              label="Active Shows"
              value={stats.activeShows}
              sub={`of ${stats.totalShows} total`}
            />
            <StatCard
              label="Avg Occupancy"
              value={`${Math.round(stats.avgOccupancy)}%`}
              sub={stats.pendingRefunds > 0 ? `${stats.pendingRefunds} refunds pending` : "No pending refunds"}
            />
          </div>

          {/* REVENUE CHART */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", flexShrink: 0 }}>
            <SectionTitle>Revenue & Bookings — Last 30 Days</SectionTitle>
            <ResponsiveContainer width="100%" height={130}>
              <AreaChart data={revenueChart} margin={{ top: 4, right: 24, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="rf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor={C.fill1} stopOpacity={0.14} />
                    <stop offset="95%" stopColor={C.fill1} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke={C.grid} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.ink3 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis yAxisId="rev" tick={{ fontSize: 10, fill: C.ink3 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <YAxis yAxisId="bk" orientation="right" tick={{ fontSize: 10, fill: C.ink3 }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTip />} />
                <Area yAxisId="rev" dataKey="revenue" name="Revenue" stroke={C.fill1} strokeWidth={2} fill="url(#rf)" dot={false} activeDot={{ r: 4 }} />
                <Area yAxisId="bk" dataKey="bookings" name="Bookings" stroke={C.fill3} strokeWidth={1.5} fill="none" dot={false} activeDot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* BOTTOM ROW: Top Shows | Occupancy | Booking Status */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 0.85fr", gap: 10, flex: 1, minHeight: 0 }}>

            {/* Top Shows by Revenue */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", overflow: "hidden" }}>
              <SectionTitle>Top Shows · Revenue</SectionTitle>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={topShows} layout="vertical" margin={{ top: 0, right: 32, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke={C.grid} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9.5, fill: C.ink3 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <YAxis
                    type="category"
                    dataKey="title"
                    width={90}
                    tick={{ fontSize: 10, fill: C.ink2 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={v => v.length > 12 ? v.slice(0, 12) + "…" : v}
                  />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="revenue" name="Revenue" fill={C.fill1} radius={[0, 5, 5, 0]} maxBarSize={18}
                    background={{ fill: C.grid, radius: 5 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Show Occupancy */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", overflow: "hidden" }}>
              <SectionTitle>Show Occupancy</SectionTitle>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={topShowsWithOcc} layout="vertical" margin={{ top: 0, right: 32, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke={C.grid} horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9.5, fill: C.ink3 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                  <YAxis
                    type="category"
                    dataKey="title"
                    width={90}
                    tick={{ fontSize: 10, fill: C.ink2 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={v => v.length > 12 ? v.slice(0, 12) + "…" : v}
                  />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="occupancy" name="Occupancy" fill={C.fill2} radius={[0, 5, 5, 0]} maxBarSize={18}
                    background={{ fill: C.grid, radius: 5 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Booking Status Donut */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", overflow: "hidden" }}>
              <SectionTitle>Booking Status</SectionTitle>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={bookingStatusDist} dataKey="count" nameKey="status" cx="50%" cy="50%"
                    innerRadius={38} outerRadius={58} paddingAngle={2}>
                    {[...bookingStatusDist]
                      .sort((a, b) => b.count - a.count)
                      .map((_, i) => (
                        <Cell key={i} fill={[C.fill1, C.fill2, C.fill3, C.fill4][i % 4]} />
                      ))}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend below */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                {[...bookingStatusDist].sort((a, b) => b.count - a.count).slice(0, 4).map((d, i) => (
                  <div key={d.status} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: [C.fill1, C.fill2, C.fill3, C.fill4][i], flexShrink: 0 }} />
                    <span style={{ color: C.ink2, flex: 1 }}>{d.status}</span>
                    <span style={{ color: C.ink3, fontFamily: "monospace" }}>{d.count}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* RIGHT — 1/3 Recent Activity (scrollable panel) */}
        <div style={{
          flex: "0 0 33.33%",
          display: "flex",
          flexDirection: "column",
          padding: "16px 20px 16px 8px",
          overflow: "hidden",
        }}>
          <div style={{
            flex: 1,
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}>
            <div style={{
              padding: "14px 16px 10px",
              borderBottom: `1px solid ${C.border}`,
              flexShrink: 0,
            }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: 0.8 }}>
                Recent Activity
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
              {recentLogs.length === 0 ? (
                <div style={{ padding: "32px 16px", textAlign: "center", color: C.ink3, fontSize: 13, fontStyle: "italic" }}>
                  No recent activity
                </div>
              ) : (
                recentLogs.map((log, idx) => (
                  <div key={log.id} style={{
                    display: "flex",
                    gap: 10,
                    padding: "10px 16px",
                    borderBottom: idx < recentLogs.length - 1 ? `1px solid ${C.border}` : undefined,
                  }}>
                    <div style={{ fontSize: 16, lineHeight: 1.2, flexShrink: 0, marginTop: 1 }}>
                      {ACTION_ICONS[log.action] ?? "·"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>
                          {log.action.replace(/_/g, " ")}
                        </span>
                        {log.bookingRef && (
                          <span style={{
                            fontSize: 10.5, color: C.ink2,
                            background: C.tag, padding: "1px 7px", borderRadius: 4,
                          }}>#{log.bookingRef}</span>
                        )}
                      </div>
                      {log.description && (
                        <div style={{ marginTop: 3, fontSize: 11.5, color: C.ink3, lineHeight: 1.4 }}>
                          {log.description}
                        </div>
                      )}
                      <div style={{ marginTop: 3, fontSize: 10.5, color: C.accent3 }}>
                        {format(new Date(log.createdAt), "d MMM · HH:mm")}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      <style>{`
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: ${C.accent3}; }
      `}</style>
    </div>
  );
}