import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Types (unchanged) ────────────────────────────────────────────────────────
interface ShowOption {
  id: string;
  title: string;
  date: string;
  city: string;
  status: string;
}

interface GatewaySplit {
  gateway: string;
  amount: number;
  count?: number;
}

interface CategoryRevenue {
  name: string;
  color: string;
  revenue: number;
  seats: number;
}

interface Summary {
  gross: number;
  refunded: number;
  net: number;
  confirmedCount: number;
  cancelledCount: number;
  totalBookings: number;
  avgTicket: number;
  totalSeats: number;
  bookedSeats: number;
  fillRate: number;
  gatewayBreakdown: GatewaySplit[];
}

interface ShowRevenue {
  showId: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  status: string;
  totalSeats: number;
  seatsSold: number;
  fillRate: number;
  confirmedCount: number;
  cancelledCount: number;
  gross: number;
  refunded: number;
  net: number;
  potential: number;
  collectionRate: number;
  avgTicket: number;
  categoryRevenue: CategoryRevenue[];
  gatewaySplit: GatewaySplit[];
}

interface TxBookingSeat {
  pricePaid: number;
  category: { name: string; color: string };
  seat: { seatCode: string };
}

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  gateway: string;
  status: string;
  paidAt: string | null;
  gatewayOrderId: string | null;
  gatewayPaymentId: string | null;
  booking: {
    bookingRef: string;
    bookerName: string;
    bookerPhone: string;
    bookerEmail: string;
    quantity: number;
    totalAmount: number;
    createdAt: string;
    show: { id: string; title: string; date: string; city: string };
    seats: TxBookingSeat[];
    cancellation: { refundAmount: number; refundStatus: string; cancelledAt: string } | null;
  };
}

type ActiveView = "overview" | "shows" | "transactions";
type TimePeriod = "full" | "today" | "week" | "month" | "3months" | "6months" | "thisyear";

// ─── Utilities ────────────────────────────────────────────────────────────────

const inr = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const inrFull = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const pct = (n: number) => `${Math.round(n)}%`;

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const fmtDT = (s: string) =>
  new Date(s).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const periodStart = (p: TimePeriod): Date => {
  const now = new Date();
  if (p === "full") return new Date(0);
  if (p === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (p === "thisyear") return new Date(now.getFullYear(), 0, 1);

  const daysMap: Record<string, number> = { week: 7, month: 30, "3months": 90, "6months": 180 };
  const d = new Date();
  d.setDate(d.getDate() - (daysMap[p] ?? 0));
  return d;
};

const PERIOD_LABELS: Record<TimePeriod, string> = {
  full: "All Time",
  today: "Today",
  week: "Last 7 Days",
  month: "Last 30 Days",
  "3months": "Last 3 Months",
  "6months": "Last 6 Months",
  thisyear: "This Year",
};

const GATEWAY_COLOR: Record<string, string> = {
  RAZORPAY: "#4A4A4A",
  CASH: "#4A4A4A",
  FREE: "#AFAFAF",
};

const GATEWAY_LABEL: Record<string, string> = {
  RAZORPAY: "Razorpay",
  CASH: "Cash",
  FREE: "Free",
};

// Axios
const API = axios.create();
API.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ─── CSV Export (unchanged logic) ────────────────────────────────────────────
const exportTransactionsCSV = (txs: Transaction[], period: TimePeriod, showName?: string) => {
  const headers = [
    "Booking Ref", "Booker Name", "Phone", "Email", "Show", "Show Date", "City",
    "Seats", "Qty", "Booking Amount", "Paid Amount", "Gateway", "Paid At",
    "Refund Status", "Refund Amount",
  ];

  const rows = txs.map((tx) => [
    tx.booking.bookingRef,
    tx.booking.bookerName,
    tx.booking.bookerPhone,
    tx.booking.bookerEmail,
    tx.booking.show.title,
    fmtDate(tx.booking.show.date),
    tx.booking.show.city,
    tx.booking.seats.map((s) => s.seat.seatCode).join("; "),
    tx.booking.quantity,
    tx.booking.totalAmount,
    tx.amount,
    tx.gateway,
    tx.paidAt ? fmtDT(tx.paidAt) : "—",
    tx.booking.cancellation?.refundStatus ?? "—",
    tx.booking.cancellation?.refundAmount ?? 0,
  ]);

  const BOM = "\uFEFF";
  const csvContent = BOM + [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `revenue_transactions_${period}_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const exportShowsCSV = (shows: ShowRevenue[]) => {
  const headers = [
    "Show", "Date", "City", "Status", "Total Seats", "Seats Sold", "Fill Rate %",
    "Confirmed", "Cancelled", "Gross Revenue", "Refunded", "Net Revenue",
    "Potential Revenue", "Collection Rate %", "Avg Ticket Price",
  ];

  const rows = shows.map((s) => [
    s.title,
    fmtDate(s.date),
    s.city,
    s.status,
    s.totalSeats,
    s.seatsSold,
    s.fillRate.toFixed(1),
    s.confirmedCount,
    s.cancelledCount,
    s.gross,
    s.refunded,
    s.net,
    s.potential.toFixed(0),
    s.collectionRate.toFixed(1),
    s.avgTicket.toFixed(0),
  ]);

  const BOM = "\uFEFF";
  const csvContent = BOM + [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `revenue_by_show_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

// ─── PDF Export (light theme adapted) ────────────────────────────────────────
const exportPDF = (
  txs: Transaction[],
  summary: Summary | null,
  period: TimePeriod,
  showName?: string
) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, doc.internal.pageSize.width, doc.internal.pageSize.height, "F");

  // Accent line
  doc.setDrawColor(74, 74, 74); // #4A4A4A
  doc.setLineWidth(0.8);
  doc.line(14, 18, doc.internal.pageSize.width - 14, 18);

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text("Revenue Report", 14, 14);

  // Metadata
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(175, 175, 175); // #AFAFAF
  doc.text(
    [
      showName ? `Show: ${showName}` : "All Shows",
      `Period: ${PERIOD_LABELS[period]}`,
      `Transactions: ${txs.length}`,
      `Generated: ${new Date().toLocaleString("en-IN")}`,
    ].join("  ·  "),
    14,
    24
  );

  // KPI boxes
  if (summary) {
    const boxes = [
      { label: "GROSS",   value: inr(summary.gross),   color: [74, 74, 74] },
      { label: "NET",     value: inr(summary.net),     color: [0, 0, 0]    },
      { label: "REFUNDED",value: inr(summary.refunded),color: [0, 0, 0]    },
      { label: "CONFIRMED", value: summary.confirmedCount.toString(), color: [74, 74, 74] },
      { label: "AVG TICKET",value: inr(summary.avgTicket), color: [74, 74, 74] },
      { label: "FILL RATE", value: pct(summary.fillRate),  color: [175, 175, 175] },
    ];

    boxes.forEach((box, i) => {
      const x = 14 + i * 46;
      doc.setFillColor(245, 245, 245); // very light gray
      doc.roundedRect(x, 28, 44, 20, 4, 4, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...box.color);
      doc.text(box.value, x + 5, 38, { maxWidth: 34 });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(175, 175, 175);
      doc.text(box.label, x + 5, 46);
    });
  }

  // Transactions Table
  autoTable(doc, {
    startY: 55,
    head: [["Ref", "Booker", "Phone", "Show", "Date", "Seats", "Paid", "Gateway", "Paid At", "Refund"]],
    body: txs.map((tx) => [
      tx.booking.bookingRef,
      tx.booking.bookerName,
      tx.booking.bookerPhone,
      tx.booking.show.title,
      fmtDate(tx.booking.show.date),
      tx.booking.seats.map((s) => s.seat.seatCode).join(", "),
      inr(tx.amount),
      GATEWAY_LABEL[tx.gateway] ?? tx.gateway,
      tx.paidAt ? fmtDT(tx.paidAt) : "—",
      tx.booking.cancellation
        ? `${inr(tx.booking.cancellation.refundAmount)} (${tx.booking.cancellation.refundStatus})`
        : "—",
    ]),
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: [74, 74, 74],
      lineColor: [229, 229, 229],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [74, 74, 74],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 32 },
      2: { cellWidth: 24 },
      3: { cellWidth: 42 },
      4: { cellWidth: 24 },
      5: { cellWidth: 32 },
      6: { cellWidth: 22, halign: "right" },
      7: { cellWidth: 24 },
      8: { cellWidth: 30 },
      9: { cellWidth: 30 },
    },
    margin: { top: 55, left: 14, right: 14 },
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(175, 175, 175);
    doc.text(
      `Page ${i} of ${pageCount}  ·  Generated by Ticket SaaS`,
      14,
      doc.internal.pageSize.height - 8
    );
  }

  doc.save(`revenue_${period}_${new Date().toISOString().split("T")[0]}.pdf`);
};

// ─── UI Components ────────────────────────────────────────────────────────────

const Pill = ({ v, style = "" }: { v: string; style?: string }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style}`}
  >
    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
    {v.replace(/_/g, " ")}
  </span>
);

const STATUS_STYLE: Record<string, string> = {
  CONFIRMED:      "bg-gray-100 text-[#4A4A4A] border-gray-300 font-medium",
  CANCELLED:      "bg-gray-200 text-black border-gray-400 font-medium",
  PAID:           "bg-gray-100 text-[#4A4A4A] border-gray-300",
  PROCESSED:      "bg-gray-100 text-[#4A4A4A] border-gray-300",
  NOT_APPLICABLE: "bg-gray-100 text-[#AFAFAF] border-gray-300",
  PENDING:        "bg-gray-100 text-[#AFAFAF] border-gray-300",
  FAILED:         "bg-gray-200 text-black border-gray-400",
  PUBLISHED:      "bg-gray-100 text-[#4A4A4A] border-gray-300",
  DRAFT:          "bg-gray-100 text-[#AFAFAF] border-gray-300",
  COMPLETED:      "bg-gray-100 text-[#4A4A4A] border-gray-300",
  BOOKING_ENABLED:"bg-gray-100 text-[#4A4A4A] border-gray-300",
  BOOKING_DISABLED:"bg-gray-100 text-[#AFAFAF] border-gray-300",
};

const KPICard = ({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  accent: string;
}) => (
  <div
    className={`relative rounded-2xl border bg-white p-5 transition-all hover:shadow-md hover:-translate-y-0.5 ${accent}`}
  >
    <div className="flex items-start justify-between mb-3">
      <span className="text-3xl">{icon}</span>
    </div>
    <p className="text-2xl font-bold text-black font-mono leading-none">{value}</p>
    <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold mt-2">{label}</p>
    {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
  </div>
);

const FillBar = ({ pct: p, sold, total }: { pct: number; sold: number; total: number }) => {
  const color = p >= 80 ? "#4A4A4A" : p >= 50 ? "#AFAFAF" : "#000000";
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs text-gray-600">
          {sold} / {total}
        </span>
        <span className="text-xs font-bold font-mono" style={{ color }}>
          {Math.round(p)}%
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${p}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
};

const GwBadge = ({ gw }: { gw: string }) => {
  const color = GATEWAY_COLOR[gw] ?? "#AFAFAF";
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border"
      style={{ backgroundColor: `${color}10`, color, borderColor: `${color}30` }}
    >
      {GATEWAY_LABEL[gw] ?? gw}
    </span>
  );
};

// ─── Row Components ───────────────────────────────────────────────────────────

const ShowRow = ({ s, expanded, onToggle }: { s: ShowRevenue; expanded: boolean; onToggle: () => void }) => {
  const fillColor = s.fillRate >= 80 ? "#4A4A4A" : s.fillRate >= 50 ? "#AFAFAF" : "#000000";

  return (
    <>
      <tr
        onClick={onToggle}
        className={`border-b border-gray-100 cursor-pointer transition-all duration-150 ${
          expanded ? "bg-gray-50" : "hover:bg-gray-50"
        }`}
      >
        <td className="pl-5 py-4 w-10">
          <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${expanded ? "bg-gray-100" : ""}`}>
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${expanded ? "rotate-90 text-black" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </td>
        <td className="px-4 py-4 max-w-[220px]">
          <p className="text-sm font-semibold text-black truncate">{s.title}</p>
          <p className="text-xs text-gray-600 mt-1">{fmtDate(s.date)} · {s.city}</p>
        </td>
        <td className="px-4 py-4">
          <Pill v={s.status} style={STATUS_STYLE[s.status]} />
        </td>
        <td className="px-4 py-4 min-w-[140px]">
          <FillBar pct={s.fillRate} sold={s.seatsSold} total={s.totalSeats} />
        </td>
        <td className="px-4 py-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-[#4A4A4A] font-semibold">✓ {s.confirmedCount}</span>
            <span className="text-sm text-black font-semibold">✕ {s.cancelledCount}</span>
          </div>
        </td>
        <td className="px-4 py-4 whitespace-nowrap">
          <span className="text-sm font-bold text-black font-mono">{inr(s.gross)}</span>
          <p className="text-xs text-gray-600 mt-1">potential: {inr(s.potential)}</p>
        </td>
        <td className="px-4 py-4 whitespace-nowrap">
          <span className={`text-sm font-bold font-mono ${s.refunded > 0 ? "text-black" : "text-gray-500"}`}>
            {s.refunded > 0 ? `−${inr(s.refunded)}` : "—"}
          </span>
        </td>
        <td className="px-4 py-4 whitespace-nowrap">
          <span className="text-base font-bold text-[#4A4A4A] font-mono">{inr(s.net)}</span>
        </td>
        <td className="px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 max-w-[80px] h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-[#4A4A4A] rounded-full" style={{ width: `${s.collectionRate}%` }} />
            </div>
            <span className="text-xs font-bold font-mono text-[#4A4A4A]">{pct(s.collectionRate)}</span>
          </div>
        </td>
        <td className="px-4 py-4 whitespace-nowrap">
          <span className="text-sm text-[#4A4A4A] font-mono font-semibold">{inr(s.avgTicket)}</span>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={10} className="px-5 sm:px-8 py-6 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Category Revenue */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-4 rounded-full bg-gray-500" />
                  Category Revenue
                </p>
                {s.categoryRevenue.length === 0 ? (
                  <p className="text-sm text-gray-500">No confirmed bookings</p>
                ) : (
                  s.categoryRevenue.map((cat, i) => {
                    const catPct = s.gross > 0 ? (cat.revenue / s.gross) * 100 : 0;
                    return (
                      <div key={i} className="mb-4 last:mb-0">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-300"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="text-sm font-medium text-gray-800">{cat.name}</span>
                            <span className="text-xs text-gray-500">({cat.seats} seats)</span>
                          </div>
                          <span className="text-sm font-bold text-black font-mono">{inr(cat.revenue)}</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${catPct}%`, backgroundColor: cat.color }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Gateway Split */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-4 rounded-full bg-gray-500" />
                  Payment Methods
                </p>
                {s.gatewaySplit.length === 0 ? (
                  <p className="text-sm text-gray-500">No payments recorded</p>
                ) : (
                  s.gatewaySplit.map((gw, i) => {
                    const gwPct = s.gross > 0 ? (gw.amount / s.gross) * 100 : 0;
                    const color = GATEWAY_COLOR[gw.gateway] ?? "#AFAFAF";
                    return (
                      <div key={i} className="mb-4 last:mb-0">
                        <div className="flex justify-between items-center mb-2">
                          <GwBadge gw={gw.gateway} />
                          <span className="text-sm font-bold text-black font-mono">{inr(gw.amount)}</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${gwPct}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Summary Box */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-4 rounded-full bg-gray-500" />
                  Revenue Summary
                </p>
                {[
                  ["Potential Revenue", inr(s.potential), "text-gray-600"],
                  ["Gross Collected", inr(s.gross), "text-black font-bold"],
                  ["Total Refunded", s.refunded > 0 ? `−${inr(s.refunded)}` : "—", "text-black"],
                  ["Net Revenue", inr(s.net), "text-[#4A4A4A] font-bold"],
                  ["Avg Ticket Price", inr(s.avgTicket), "text-[#4A4A4A]"],
                  ["Collection Rate", pct(s.collectionRate), "text-[#4A4A4A] font-bold"],
                ].map(([l, v, cls]) => (
                  <div
                    key={l}
                    className="flex justify-between items-center py-2.5 border-b border-gray-100 last:border-0"
                  >
                    <span className="text-xs text-gray-600 uppercase tracking-wider font-medium">{l}</span>
                    <span className={`text-sm font-mono ${cls}`}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

const TxRow = ({ tx, expanded, onToggle }: { tx: Transaction; expanded: boolean; onToggle: () => void }) => (
  <>
    <tr
      onClick={onToggle}
      className={`border-b border-gray-100 cursor-pointer transition-all ${
        expanded ? "bg-gray-50" : "hover:bg-gray-50"
      }`}
    >
      <td className="pl-5 py-4 w-10">
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? "rotate-90 text-black" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <span className="font-mono text-sm font-semibold text-gray-800">{tx.booking.bookingRef}</span>
      </td>
      <td className="px-4 py-4">
        <p className="text-sm font-medium text-black whitespace-nowrap">{tx.booking.bookerName}</p>
        <p className="text-xs text-gray-600 font-mono">{tx.booking.bookerPhone}</p>
      </td>
      <td className="px-4 py-4 max-w-[180px]">
        <p className="text-sm text-gray-800 truncate font-medium">{tx.booking.show.title}</p>
        <p className="text-xs text-gray-600">
          {fmtDate(tx.booking.show.date)} · {tx.booking.show.city}
        </p>
      </td>
      <td className="px-4 py-4">
        <div className="flex flex-wrap gap-1.5">
          {tx.booking.seats.slice(0, 3).map((bs) => (
            <span
              key={bs.seat.seatCode}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono bg-gray-100 text-gray-700 border border-gray-200"
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: bs.category.color }} />
              {bs.seat.seatCode}
            </span>
          ))}
          {tx.booking.seats.length > 3 && (
            <span className="text-xs text-gray-500 self-center">+{tx.booking.seats.length - 3}</span>
          )}
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <span className="text-sm font-bold text-black font-mono">{inr(tx.amount)}</span>
      </td>
      <td className="px-4 py-4">
        <GwBadge gw={tx.gateway} />
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <span className="text-xs text-gray-600">{tx.paidAt ? fmtDT(tx.paidAt) : "—"}</span>
      </td>
      <td className="px-4 py-4">
        {tx.booking.cancellation ? (
          <div className="space-y-1">
            <Pill v={tx.booking.cancellation.refundStatus} style={STATUS_STYLE[tx.booking.cancellation.refundStatus]} />
            <p className="text-xs text-gray-600 font-mono">{inr(tx.booking.cancellation.refundAmount)}</p>
          </div>
        ) : (
          <span className="text-gray-400 text-lg">—</span>
        )}
      </td>
    </tr>

    {expanded && (
      <tr>
        <td colSpan={9} className="px-5 sm:px-8 py-6 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Booker Info */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-1.5 h-4 rounded-full bg-gray-500" />
                Booker Details
              </p>
              {[
                ["Name", tx.booking.bookerName],
                ["Phone", tx.booking.bookerPhone],
                ["Email", tx.booking.bookerEmail],
                ["Booked On", fmtDT(tx.booking.createdAt)],
              ].map(([l, v]) => (
                <div
                  key={l}
                  className="flex justify-between py-2.5 border-b border-gray-100 last:border-0 gap-4"
                >
                  <span className="text-xs text-gray-600 uppercase tracking-wider shrink-0">{l}</span>
                  <span className="text-sm text-gray-800 text-right break-all">{v}</span>
                </div>
              ))}
            </div>

            {/* Payment Info */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-1.5 h-4 rounded-full bg-gray-500" />
                Payment Details
              </p>
              {[
                ["Amount", inrFull(tx.amount)],
                ["Gateway", GATEWAY_LABEL[tx.gateway] ?? tx.gateway],
                ["Paid At", tx.paidAt ? fmtDT(tx.paidAt) : "—"],
                ["Order ID", tx.gatewayOrderId ?? "—"],
                ["Payment ID", tx.gatewayPaymentId ?? "—"],
              ].map(([l, v]) => (
                <div
                  key={l}
                  className="flex justify-between py-2.5 border-b border-gray-100 last:border-0 gap-4"
                >
                  <span className="text-xs text-gray-600 uppercase tracking-wider shrink-0">{l}</span>
                  <span className="text-sm text-gray-800 font-mono text-right break-all">{v}</span>
                </div>
              ))}
            </div>

            {/* Seats */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-1.5 h-4 rounded-full bg-gray-500" />
                Seats · {tx.booking.quantity}
              </p>
              <div className="grid grid-cols-2 gap-3 mb-5">
                {tx.booking.seats.map((bs) => (
                  <div
                    key={bs.seat.seatCode}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: bs.category.color }} />
                      <span className="font-mono font-semibold text-black text-sm">{bs.seat.seatCode}</span>
                    </div>
                    <p className="text-xs text-gray-600">{bs.category.name}</p>
                    <p className="text-sm font-bold text-gray-800 font-mono mt-1">{inr(bs.pricePaid)}</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center rounded-lg bg-gray-100 border border-gray-200 px-4 py-3">
                <span className="text-sm text-gray-600 font-semibold">Total Paid</span>
                <span className="text-lg font-bold text-black font-mono">{inr(tx.amount)}</span>
              </div>
            </div>
          </div>
        </td>
      </tr>
    )}
  </>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Revenue() {
  const [shows, setShows] = useState<ShowOption[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [showRevenues, setShowRevenues] = useState<ShowRevenue[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedShow, setSelectedShow] = useState<string>("");
  const [activeView, setActiveView] = useState<ActiveView>("overview");
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("full");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadShows = useCallback(async () => {
    try {
      const res = await API.get("/api/revenue/shows");
      setShows(res.data.data ?? []);
    } catch (e: any) {
      console.error("[revenue/shows]", e.message);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = selectedShow ? { showId: selectedShow } : {};

      const [summaryRes, showsRes, txRes] = await Promise.all([
        API.get("/api/revenue/summary", { params }),
        API.get("/api/revenue/shows-breakdown"),
        API.get("/api/revenue/transactions", { params }),
      ]);

      setSummary(summaryRes.data.data ?? null);
      setShowRevenues(showsRes.data.data ?? []);
      setTransactions(txRes.data.data ?? []);
    } catch (e: any) {
      const msg = e.response?.data?.message ?? e.message ?? "Failed to load revenue data";
      setError(`${e.response?.status ? `HTTP ${e.response.status}: ` : ""}${msg}`);
    } finally {
      setLoading(false);
    }
  }, [selectedShow]);

  useEffect(() => { loadShows(); }, [loadShows]);
  useEffect(() => { loadData(); }, [loadData]);

  const start = periodStart(timePeriod);

  const filteredTx = transactions.filter((tx) => {
    const dateOk = tx.paidAt
      ? new Date(tx.paidAt) >= start
      : new Date(tx.booking.createdAt) >= start;

    const q = search.trim().toLowerCase();
    const searchOk =
      !q ||
      tx.booking.bookerName.toLowerCase().includes(q) ||
      tx.booking.bookingRef.toLowerCase().includes(q) ||
      tx.booking.bookerPhone.includes(q) ||
      tx.booking.bookerEmail.toLowerCase().includes(q) ||
      tx.booking.show.title.toLowerCase().includes(q) ||
      tx.booking.seats.some((s) => s.seat.seatCode.toLowerCase().includes(q));

    const showOk = !selectedShow || tx.booking.show.id === selectedShow;

    return dateOk && searchOk && showOk;
  });

  const filteredShows = showRevenues.filter((s) => {
    const q = search.trim().toLowerCase();
    return !q || s.title.toLowerCase().includes(q) || s.city.toLowerCase().includes(q);
  });

  const filteredGross = filteredTx.reduce((sum, tx) => sum + tx.amount, 0);
  const filteredRefunded = filteredTx.reduce(
    (sum, tx) => sum + (tx.booking.cancellation?.refundAmount ?? 0),
    0
  );

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center">
                <span className="text-xl">💰</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-black tracking-tight">Revenue</h1>
            </div>
            <p className="text-sm text-gray-600 ml-0 sm:ml-13">
              {selectedShow
                ? `Show: ${shows.find((s) => s.id === selectedShow)?.title ?? "Selected show"}`
                : "Financial overview across all your shows"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <button
              onClick={() =>
                activeView === "shows"
                  ? exportShowsCSV(filteredShows)
                  : exportTransactionsCSV(filteredTx, timePeriod, shows.find((s) => s.id === selectedShow)?.title)
              }
              disabled={filteredTx.length === 0 && filteredShows.length === 0}
              className="flex items-center gap-3 px-4 py-2 rounded-xl bg-gray-100 border border-gray-300 text-sm text-gray-700 hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              CSV
            </button>

            <button
              onClick={() =>
                exportPDF(
                  filteredTx,
                  summary,
                  timePeriod,
                  shows.find((s) => s.id === selectedShow)?.title
                )
              }
              disabled={filteredTx.length === 0}
              className="flex items-center gap-3 px-4 py-2 rounded-xl bg-gray-100 border border-gray-300 text-sm text-gray-700 hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              PDF
            </button>

            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-3 px-4 py-2 rounded-xl bg-gray-100 border border-gray-300 text-sm text-gray-700 hover:bg-gray-200 transition-all disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-2xl bg-red-50 border border-red-200 px-5 py-4 flex items-start gap-4">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-700">Error loading data</p>
              <p className="text-sm text-red-600 mt-0.5">{error}</p>
            </div>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm rounded-xl transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* KPI Cards */}
        {summary && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            <KPICard
              icon="💰"
              label="Gross Revenue"
              value={inr(summary.gross)}
              sub={`${summary.confirmedCount} confirmed bookings`}
              accent="border-gray-200 hover:border-gray-300"
            />
            <KPICard
              icon="✅"
              label="Net Revenue"
              value={inr(summary.net)}
              sub={summary.refunded > 0 ? `After ${inr(summary.refunded)} refunded` : "No refunds"}
              accent="border-gray-200 hover:border-gray-300"
            />
            <KPICard
              icon="↩"
              label="Refunded"
              value={inr(summary.refunded)}
              sub={`${summary.cancelledCount} cancellations`}
              accent="border-gray-200 hover:border-gray-300"
            />
            <KPICard
              icon="🎫"
              label="Avg Ticket"
              value={inr(summary.avgTicket)}
              sub={`${summary.bookedSeats} seats sold`}
              accent="border-gray-200 hover:border-gray-300"
            />
            <KPICard
              icon="📊"
              label="Fill Rate"
              value={pct(summary.fillRate)}
              sub={`${summary.bookedSeats} / ${summary.totalSeats} seats`}
              accent="border-gray-200 hover:border-gray-300"
            />
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-200">

          {/* View Tabs */}
          <div className="flex bg-white border border-gray-200 rounded-xl p-1 gap-1 w-full sm:w-auto">
            {[
              { key: "overview" as ActiveView, label: "Overview", icon: "◈" },
              { key: "shows" as ActiveView, label: "By Show", icon: "🎭" },
              { key: "transactions" as ActiveView, label: "Transactions", icon: "↗" },
            ].map((v) => (
              <button
                key={v.key}
                onClick={() => {
                  setActiveView(v.key);
                  setExpandedId(null);
                }}
                className={`flex items-center gap-2 px-4 sm:px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeView === v.key
                    ? "bg-black text-white shadow-sm"
                    : "text-gray-600 hover:text-black hover:bg-gray-100"
                }`}
              >
                <span>{v.icon}</span>
                {v.label}
              </button>
            ))}
          </div>

          {/* Show Filter */}
          <div className="relative w-full sm:w-64">
            <select
              value={selectedShow}
              onChange={(e) => {
                setSelectedShow(e.target.value);
                setExpandedId(null);
              }}
              className="w-full bg-white border border-gray-300 rounded-xl px-4 pr-10 py-2.5 text-sm text-black focus:outline-none focus:border-gray-400 transition-colors appearance-none cursor-pointer"
            >
              <option value="">All Shows</option>
              {shows.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} — {fmtDate(s.date)}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Time Period */}
          <div className="relative w-full sm:w-52">
            <select
              value={timePeriod}
              onChange={(e) => setTimePeriod(e.target.value as TimePeriod)}
              className="w-full bg-white border border-gray-300 rounded-xl px-4 pr-10 py-2.5 text-sm text-black focus:outline-none focus:border-gray-400 transition-colors appearance-none cursor-pointer"
            >
              {Object.entries(PERIOD_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search name, ref, seat, show…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-10 py-2.5 text-sm text-black placeholder-gray-500 focus:outline-none focus:border-gray-400 transition-colors"
            
            />
           
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
             
          </div>
          
        </div>

        {/* Loading */}
        {loading && (
          <div className="rounded-2xl border border-gray-200 bg-white flex flex-col items-center justify-center gap-4 py-28 shadow-sm">
            <svg className="w-10 h-10 text-gray-700 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8z"
              />
            </svg>
            <p className="text-gray-600">Loading revenue data...</p>
          </div>
        )}

        {/* Main Content */}
        {!loading && !error && (
          <>
            {/* Transactions View */}
            {activeView === "transactions" && (
              <>
                {filteredTx.length > 0 && (
                  <div className="flex flex-wrap items-center gap-4 sm:gap-6 px-5 py-4 rounded-2xl bg-gray-50 border border-gray-200">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600">Showing</span>
                      <span className="text-lg font-bold text-black">{filteredTx.length}</span>
                      <span className="text-sm text-gray-600">paid transactions</span>
                    </div>
                    <div className="hidden sm:block h-5 w-px bg-gray-300" />
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600">Total collected</span>
                      <span className="text-xl font-bold text-black">{inr(filteredGross)}</span>
                    </div>
                    {filteredRefunded > 0 && (
                      <>
                        <div className="hidden sm:block h-5 w-px bg-gray-300" />
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-600">Refunded</span>
                          <span className="text-xl font-bold text-black">−{inr(filteredRefunded)}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                  <div className="px-5 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                    <p className="text-sm font-medium text-gray-800">Paid Transactions</p>
                    <span className="text-xs text-gray-500">{filteredTx.length} records</span>
                  </div>

                  {filteredTx.length === 0 ? (
                    <div className="py-20 text-center text-gray-600">
                      <p className="text-lg font-medium">No transactions found</p>
                      <p className="text-sm mt-2">Try changing the time period or clearing the search</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-max">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50">
                            {["", "Ref", "Booker", "Show", "Seats", "Amount", "Gateway", "Paid At", "Refund"].map((h, i) => (
                              <th
                                key={i}
                                className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 sm:px-6 py-4 first:pl-5 last:pr-5"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredTx.map((tx) => (
                            <TxRow
                              key={tx.id}
                              tx={tx}
                              expanded={expandedId === tx.id}
                              onToggle={() => setExpandedId((p) => (p === tx.id ? null : tx.id))}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* By Show View */}
            {activeView === "shows" && (
              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                <div className="px-5 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                  <p className="text-sm font-medium text-gray-800">Revenue by Show</p>
                  <span className="text-xs text-gray-500">{filteredShows.length} shows</span>
                </div>

                {filteredShows.length === 0 ? (
                  <div className="py-20 text-center text-gray-600">
                    <p className="text-lg font-medium">No shows match your filter</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-max">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          {[
                            "",
                            "Show",
                            "Status",
                            "Fill Rate",
                            "Bookings",
                            "Gross / Potential",
                            "Refunded",
                            "Net",
                            "Collection %",
                            "Avg Ticket",
                          ].map((h, i) => (
                            <th
                              key={i}
                              className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 sm:px-6 py-4 first:pl-5 last:pr-6 whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredShows.map((s) => (
                          <ShowRow
                            key={s.showId}
                            s={s}
                            expanded={expandedId === s.showId}
                            onToggle={() => setExpandedId((p) => (p === s.showId ? null : s.showId))}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Overview View */}
            {activeView === "overview" && (
              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                <div className="px-5 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                  <p className="text-sm font-medium text-gray-800">All Shows Overview</p>
                  <span className="text-xs text-gray-500">{showRevenues.length} shows</span>
                </div>

                {showRevenues.length === 0 ? (
                  <div className="py-20 text-center text-gray-600">
                    <p className="text-lg font-medium">No revenue data available</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-max">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          {["Show", "Status", "Seats Sold", "Confirmed", "Gross", "Net", "Avg Ticket"].map((h, i) => (
                            <th
                              key={i}
                              className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 sm:px-6 py-4 first:pl-5 last:pr-6 whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {showRevenues.map((s) => (
                          <tr
                            key={s.showId}
                            className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-4 sm:px-6 py-4 max-w-[240px]">
                              <p className="text-sm font-medium text-black truncate">{s.title}</p>
                              <p className="text-xs text-gray-600 mt-1">
                                {fmtDate(s.date)} · {s.city}
                              </p>
                            </td>
                            <td className="px-4 sm:px-6 py-4">
                              <Pill v={s.status} style={STATUS_STYLE[s.status]} />
                            </td>
                            <td className="px-4 sm:px-6 py-4">
                              <FillBar pct={s.fillRate} sold={s.seatsSold} total={s.totalSeats} />
                            </td>
                            <td className="px-4 sm:px-6 py-4">
                              <span className="text-sm font-bold text-gray-700">{s.confirmedCount}</span>
                              {s.cancelledCount > 0 && (
                                <span className="text-xs text-black ml-2">−{s.cancelledCount}</span>
                              )}
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                              <span className="text-sm font-bold text-black">{inr(s.gross)}</span>
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                              <span className="text-sm font-bold text-gray-700">{inr(s.net)}</span>
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                              <span className="text-sm text-gray-700 font-medium">{inr(s.avgTicket)}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Footer Info */}
        {!loading && !error && (
          <p className="text-xs text-gray-600 text-right">
            {activeView === "transactions"
              ? `Showing ${filteredTx.length} of ${transactions.length} transactions`
              : activeView === "shows"
              ? `Showing ${filteredShows.length} of ${showRevenues.length} shows`
              : `${showRevenues.length} shows · ${transactions.length} transactions`}
          </p>
        )}
      </div>
    </div>
  );
}