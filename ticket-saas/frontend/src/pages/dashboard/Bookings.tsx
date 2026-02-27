import { useEffect, useState, useCallback } from "react";
import React from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ShowOption { id: string; title: string; date: string; city: string }
interface BookingSeat {
  seat:     { seatCode: string; rowLabel: string };
  category: { name: string; color: string; price: number };
  pricePaid: number;
}
interface Transaction {
  amount: number; currency: string; gateway: string; status: string;
  paidAt: string | null; gatewayOrderId: string | null;
  gatewayPaymentId: string | null; failureReason: string | null;
}
interface Cancellation {
  refundAmount: number; refundPercent: number; hoursBeforeShow: number;
  refundStatus: string; reason: string | null;
  cancelledAt: string; refundedAt: string | null;
}
interface Booking {
  id: string; bookingRef: string; bookerName: string; bookerAge: number;
  bookerEmail: string; bookerPhone: string; quantity: number;
  totalAmount: number; status: string; source: string; createdAt: string;
  ticketQR: string | null;
  show: { id: string; title: string; date: string; time: string; venue: string; city: string };
  seats: BookingSeat[];
  transaction: Transaction | null;
  cancellation: Cancellation | null;
}
interface Stats {
  confirmedBookings: number; cancelledBookings: number;
  pendingBookings: number; totalBookings: number;
  totalRevenue: number; totalRefunded: number; netRevenue: number;
}

type FilterTab  = "all" | "confirmed" | "cancelled" | "pending";
type DetailTab  = "booking" | "transaction" | "cancellation";
type TimePeriod = "full" | "today" | "week" | "2weeks" | "month" | "3months" | "6months" | "thisyear";

// ─── Utilities ────────────────────────────────────────────────────────────────
const inr = (n: number) => "₹" + n.toLocaleString("en-IN");
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const fmtDT = (s: string) =>
  new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const periodStart = (p: TimePeriod): Date => {
  const now = new Date();
  if (p === "full")     return new Date(0);
  if (p === "today")    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (p === "thisyear") return new Date(now.getFullYear(), 0, 1);
  const days: Record<string, number> = { week:7, "2weeks":14, month:30, "3months":90, "6months":180 };
  const d = new Date(); d.setDate(d.getDate() - (days[p] ?? 0)); return d;
};
const PERIOD_LABEL: Record<TimePeriod, string> = {
  full:"All Time", today:"Today", week:"Last 7 Days", "2weeks":"Last 14 Days",
  month:"Last 30 Days", "3months":"Last 3 Months", "6months":"Last 6 Months", thisyear:"This Year",
};

const API = axios.create();
API.interceptors.request.use(cfg => {
  const t = localStorage.getItem("token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// ─── CSV / PDF exports (unchanged) ───────────────────────────────────────────
const exportCSV = (rows: Booking[], period: TimePeriod) => {
  const headers = ["Ref","Name","Phone","Email","Age","Show","Date","Seats","Amount","Status","Gateway","Paid At","Refund Status","Refund Amount","Booked On"];
  const data = rows.map(b => [b.bookingRef,b.bookerName,b.bookerPhone,b.bookerEmail,b.bookerAge,b.show.title,fmtDate(b.show.date),b.seats.map(s=>s.seat.seatCode).join("; "),b.totalAmount,b.status,b.transaction?.gateway??"—",b.transaction?.paidAt?fmtDT(b.transaction.paidAt):"—",b.cancellation?.refundStatus??"—",b.cancellation?.refundAmount??0,fmtDT(b.createdAt)]);
  const csv=[headers,...data].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
  const a=document.createElement("a");a.href=url;a.download=`bookings_${period}_${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
};

const exportPDF = (rows: Booking[], period: TimePeriod, showName?: string) => {
  const doc = new jsPDF({ orientation:"landscape", unit:"mm", format:"a4" });
  doc.setFillColor(255,255,255);doc.rect(0,0,297,210,"F");
  doc.setDrawColor(74,74,74);doc.setLineWidth(0.8);doc.line(14,18,283,18);
  doc.setFont("helvetica","bold");doc.setFontSize(20);doc.setTextColor(0,0,0);doc.text("Bookings Report",14,14);
  doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(175,175,175);
  doc.text([showName?`Show: ${showName}`:"All Shows",`Period: ${PERIOD_LABEL[period]}`,`Total: ${rows.length}`,`Generated: ${new Date().toLocaleString("en-IN")}`].join("  ·  "),14,24);
  const conf=rows.filter(b=>b.status==="CONFIRMED").length,canc=rows.filter(b=>b.status==="CANCELLED").length;
  const rev=rows.filter(b=>b.status==="CONFIRMED").reduce((s,b)=>s+b.totalAmount,0),ref=rows.reduce((s,b)=>s+(b.cancellation?.refundAmount??0),0);
  const sY=32;
  ([{label:"Total",value:String(rows.length),color:[0,0,0] as [number,number,number]},{label:"Confirmed",value:String(conf),color:[74,74,74] as [number,number,number]},{label:"Cancelled",value:String(canc),color:[0,0,0] as [number,number,number]},{label:"Revenue",value:rev.toLocaleString("en-IN"),color:[74,74,74] as [number,number,number]},{label:"Refunded",value:ref.toLocaleString("en-IN"),color:[175,175,175] as [number,number,number]}]).forEach((box,i)=>{
    const x=14+i*54;doc.setFillColor(245,245,245);doc.roundedRect(x,sY,50,18,4,4,"F");
    doc.setFont("helvetica","bold");doc.setFontSize(11);doc.setTextColor(...box.color);doc.text(box.value,x+4,sY+9);
    doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(175,175,175);doc.text(box.label.toUpperCase(),x+4,sY+15);
  });
  autoTable(doc,{startY:sY+26,head:[["Ref","Booker","Phone","Show","Date","Seats","Amount","Status","Gateway","Tx","Refund","Refund Status","Booked"]],body:rows.map(b=>[b.bookingRef,b.bookerName,b.bookerPhone,b.show.title,fmtDate(b.show.date),b.seats.map(s=>s.seat.seatCode).join(", "),b.totalAmount.toLocaleString("en-IN"),b.status,b.transaction?.gateway??"—",b.transaction?.status??"—",b.cancellation?b.cancellation.refundAmount.toLocaleString("en-IN"):"—",b.cancellation?.refundStatus?.replace(/_/g," ")??"—",fmtDate(b.createdAt)]),theme:"grid",styles:{fontSize:8,cellPadding:3,textColor:[74,74,74],lineColor:[229,229,229],lineWidth:0.1},headStyles:{fillColor:[245,245,245],textColor:[74,74,74],fontStyle:"bold",fontSize:8},alternateRowStyles:{fillColor:[250,250,250]},columnStyles:{0:{cellWidth:22,textColor:[74,74,74],fontStyle:"bold"},6:{cellWidth:20,textColor:[0,0,0],fontStyle:"bold"},7:{cellWidth:22},10:{cellWidth:20,textColor:[175,175,175]}},didParseCell(data){if(data.section==="body"){const v=String(data.cell.raw);if(data.column.index===7){if(v==="CONFIRMED")data.cell.styles.textColor=[74,74,74];if(v==="CANCELLED")data.cell.styles.textColor=[0,0,0];if(v==="PENDING"||v==="SEATS_SELECTED")data.cell.styles.textColor=[175,175,175];}if(data.column.index===9){if(v==="PAID")data.cell.styles.textColor=[74,74,74];if(v==="FAILED")data.cell.styles.textColor=[0,0,0];}if(data.column.index===11){if(v==="PROCESSED")data.cell.styles.textColor=[74,74,74];if(v==="FAILED")data.cell.styles.textColor=[0,0,0];if(v==="NOT APPLICABLE")data.cell.styles.textColor=[175,175,175];}}},margin:{left:14,right:14}});
  const pc=(doc as any).internal.getNumberOfPages();
  for(let i=1;i<=pc;i++){doc.setPage(i);doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(175,175,175);doc.text(`Page ${i} of ${pc}  ·  Ticket SaaS — Bookings Report`,14,doc.internal.pageSize.height-8);}
  doc.save(`bookings_${period}_${new Date().toISOString().slice(0,10)}.pdf`);
};

// ─── UI Primitives ────────────────────────────────────────────────────────────
const BADGE_STYLE: Record<string, string> = {
  CONFIRMED:"bg-gray-100 text-[#4A4A4A] border-gray-300",  CANCELLED:"bg-gray-200 text-black border-gray-400",
  PENDING:"bg-gray-100 text-[#AFAFAF] border-gray-300",    SEATS_SELECTED:"bg-gray-100 text-[#AFAFAF] border-gray-300",
  PAID:"bg-gray-100 text-[#4A4A4A] border-gray-300",       FAILED:"bg-gray-200 text-black border-gray-400",
  PROCESSED:"bg-gray-100 text-[#4A4A4A] border-gray-300",  NOT_APPLICABLE:"bg-gray-100 text-[#AFAFAF] border-gray-300",
  REFUNDED:"bg-gray-100 text-[#4A4A4A] border-gray-300",   CHECKED_IN:"bg-gray-100 text-[#4A4A4A] border-gray-300",
};

const Badge = ({ v }: { v: string }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${BADGE_STYLE[v] ?? "bg-gray-100 text-gray-700 border-gray-300"}`}>
    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 shrink-0" />
    {v.replace(/_/g, " ")}
  </span>
);

const SectionLabel = ({ color, children }: { color: string; children: string }) => (
  <div className="flex items-center gap-2 mb-5">
    <span className={`w-1 h-4 rounded-full ${color}`} />
    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">{children}</p>
  </div>
);

const InfoRow = ({ label, value, accent, mono }: { label: string; value: string; accent?: string; mono?: boolean }) => (
  <div className="flex items-start justify-between gap-6 py-3 border-b border-gray-100 last:border-0">
    <span className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold shrink-0 pt-px">{label}</span>
    <span className={`text-sm text-right break-all leading-snug ${mono ? "font-mono" : ""} ${accent ?? "text-gray-900 font-medium"}`}>{value}</span>
  </div>
);

const StatCard = ({ icon, label, value, sub }: { icon: string; label: string; value: string | number; sub?: string }) => (
  <div className="rounded-2xl border border-gray-200 bg-white px-5 py-5 hover:shadow-md hover:border-gray-300 transition-all duration-150">
    <span className="text-2xl block mb-3">{icon}</span>
    <p className="text-[26px] font-bold text-black font-mono leading-none">{value}</p>
    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mt-2.5">{label}</p>
    {sub && <p className="text-xs text-gray-400 mt-1.5">{sub}</p>}
  </div>
);

// ─── QR Modal ─────────────────────────────────────────────────────────────────
const QRModal = ({ url, bookingRef, onClose }: { url: string; bookingRef: string; onClose: () => void }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
    <div className="bg-white border border-gray-200 rounded-3xl p-8 flex flex-col items-center gap-5 shadow-2xl max-w-sm w-[90%]" onClick={e => e.stopPropagation()}>
      <div className="text-center">
        <p className="text-xs text-gray-500 font-mono mb-1">{bookingRef}</p>
        <p className="text-sm font-medium text-gray-700">Ticket QR Code</p>
      </div>
      <div className="p-4 bg-white rounded-2xl shadow border border-gray-200">
        <img src={url} alt="QR" className="w-56 h-56" />
      </div>
      <p className="text-xs text-gray-500 text-center">Show this at the venue entrance</p>
      <button onClick={onClose} className="text-sm text-gray-600 hover:text-black border border-gray-300 px-6 py-2.5 rounded-xl transition-all hover:bg-gray-50">Close</button>
    </div>
  </div>
);

// ─── Detail Panel ─────────────────────────────────────────────────────────────
const DetailPanel = ({ b, onClose }: { b: Booking; onClose: () => void }) => {
  const [tab, setTab] = useState<DetailTab>("booking");
  const [qr,  setQr]  = useState(false);

  useEffect(() => {
    if (b.status === "CANCELLED" && b.cancellation) setTab("cancellation");
    else setTab("booking");
  }, [b.id]);

  const tabs = [
    { key: "booking"     as DetailTab, label: "Booking",      available: true,            badge: null },
    { key: "transaction" as DetailTab, label: "Transaction",  available: !!b.transaction, badge: b.transaction?.status ?? null },
    { key: "cancellation"as DetailTab, label: "Cancellation", available:!!b.cancellation, badge: b.cancellation?.refundStatus ?? null },
  ];

  return (
    <>
      {qr && b.ticketQR && <QRModal url={b.ticketQR} bookingRef={b.bookingRef} onClose={() => setQr(false)} />}
      <div className="border-t border-gray-200 bg-white">

        {/* Sub-header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-5 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center">
                <span className="text-lg font-bold text-gray-700">{b.bookerName[0].toUpperCase()}</span>
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${b.status === "CONFIRMED" ? "bg-gray-600" : b.status === "CANCELLED" ? "bg-black" : "bg-gray-400"}`} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                <span className="text-base font-bold text-black">{b.bookerName}</span>
                <Badge v={b.status} />
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                <span className="font-mono">{b.bookingRef}</span>
                <span>·</span>
                <span className="truncate max-w-[180px]">{b.show.title}</span>
                <span>·</span>
                <span>{fmtDate(b.show.date)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="px-4 py-2 rounded-xl bg-white border border-gray-200">
              <span className="text-base font-bold text-black font-mono">{inr(b.totalAmount)}</span>
            </div>
            {b.ticketQR && (
              <button onClick={() => setQr(true)} className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm text-gray-700 hover:bg-gray-100 transition-all">View QR</button>
            )}
            <button onClick={onClose} className="p-2 rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-100 transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3 border-b border-gray-200 bg-white">
          {tabs.map(t => (
            <button key={t.key} disabled={!t.available} onClick={() => t.available && setTab(t.key)}
              className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium rounded-t-lg border border-b-0 transition-all ${
                tab === t.key
                  ? "bg-white border-gray-200 text-black shadow-sm -mb-px z-10"
                  : t.available ? "border-transparent text-gray-500 hover:text-black hover:bg-gray-50"
                  : "border-transparent text-gray-300 cursor-not-allowed"
              }`}>
              {t.label}
              {t.badge && t.available && <Badge v={t.badge} />}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {tab === "booking" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <SectionLabel color="bg-gray-400">Booker Info</SectionLabel>
                <InfoRow label="Name"   value={b.bookerName} />
                <InfoRow label="Age"    value={`${b.bookerAge} years`} />
                <InfoRow label="Phone"  value={b.bookerPhone} mono />
                <InfoRow label="Email"  value={b.bookerEmail} />
                <InfoRow label="Source" value={b.source} />
                <InfoRow label="Booked" value={fmtDT(b.createdAt)} />
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <SectionLabel color="bg-gray-500">Show Info</SectionLabel>
                <InfoRow label="Title" value={b.show.title} />
                <InfoRow label="Date"  value={fmtDate(b.show.date)} />
                <InfoRow label="Time"  value={b.show.time} />
                <InfoRow label="Venue" value={b.show.venue} />
                <InfoRow label="City"  value={b.show.city} />
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <SectionLabel color="bg-gray-600">Seats · {b.quantity}</SectionLabel>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {b.seats.map(bs => (
                    <div key={bs.seat.seatCode} className="rounded-xl border border-gray-200 bg-gray-50 p-3.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: bs.category.color }} />
                        <span className="font-mono font-semibold text-black text-sm">{bs.seat.seatCode}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{bs.category.name}</p>
                      <p className="text-sm font-bold text-gray-800 font-mono mt-1.5">{inr(bs.pricePaid)}</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center rounded-xl bg-gray-100 border border-gray-200 px-4 py-3.5">
                  <span className="text-sm text-gray-600 font-semibold">Total Paid</span>
                  <span className="text-lg font-bold text-black font-mono">{inr(b.totalAmount)}</span>
                </div>
              </div>
            </div>
          )}

          {tab === "transaction" && b.transaction && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <SectionLabel color="bg-gray-500">Payment Details</SectionLabel>
                <InfoRow label="Amount"     value={`${inr(b.transaction.amount)} ${b.transaction.currency}`} accent="text-black font-bold font-mono" />
                <InfoRow label="Gateway"    value={b.transaction.gateway} />
                <InfoRow label="Status"     value={b.transaction.status} />
                <InfoRow label="Paid At"    value={b.transaction.paidAt ? fmtDT(b.transaction.paidAt) : "Not paid"} />
                {b.transaction.gatewayOrderId   && <InfoRow label="Order ID"   value={b.transaction.gatewayOrderId}   mono />}
                {b.transaction.gatewayPaymentId && <InfoRow label="Payment ID" value={b.transaction.gatewayPaymentId} mono />}
                {b.transaction.failureReason && (
                  <div className="mt-5 rounded-xl bg-red-50 border border-red-200 p-4">
                    <p className="text-[11px] font-bold text-red-600 uppercase tracking-wider mb-2">Failure Reason</p>
                    <p className="text-sm text-red-600 leading-relaxed">{b.transaction.failureReason}</p>
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <SectionLabel color="bg-gray-600">Payment Status</SectionLabel>
                <div className="flex items-center mt-5 mb-10">
                  {(["PENDING", "PAID"] as const).map((step, i) => {
                    const isPaid=b.transaction!.status==="PAID", isFailed=b.transaction!.status==="FAILED", done=isPaid||step==="PENDING";
                    return (
                      <div key={step} className="flex items-center flex-1">
                        <div className="flex flex-col items-center gap-2">
                          <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all ${isFailed&&step==="PENDING"?"bg-black border-black text-white":done?"bg-gray-700 border-gray-700 text-white":"border-gray-300 text-gray-400"}`}>
                            {isFailed&&step==="PENDING"?"✕":done?"✓":i+1}
                          </div>
                          <span className="text-xs text-gray-500 font-medium">{step}</span>
                        </div>
                        {i<1&&<div className={`flex-1 h-0.5 mx-4 rounded-full ${isPaid?"bg-gray-700":"bg-gray-200"}`}/>}
                      </div>
                    );
                  })}
                </div>
                <div className={`rounded-xl border p-4 ${b.transaction.status==="PAID"?"bg-gray-50 border-gray-300":b.transaction.status==="FAILED"?"bg-red-50 border-red-200":"bg-gray-50 border-gray-200"}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 font-semibold">Paid Amount</span>
                    <span className={`text-lg font-bold font-mono ${b.transaction.status==="PAID"?"text-black":"text-gray-400"}`}>
                      {b.transaction.status==="PAID"?inr(b.transaction.amount):"—"}
                    </span>
                  </div>
                  {b.transaction.paidAt&&<p className="text-xs text-gray-500 mt-1.5">{fmtDT(b.transaction.paidAt)}</p>}
                </div>
              </div>
            </div>
          )}

          {tab === "cancellation" && b.cancellation && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <SectionLabel color="bg-gray-500">Cancellation Details</SectionLabel>
                <InfoRow label="Cancelled At"      value={fmtDT(b.cancellation.cancelledAt)} />
                <InfoRow label="Hours Before Show" value={`${b.cancellation.hoursBeforeShow.toFixed(1)} hrs`} />
                <InfoRow label="Refund Policy"     value={`${b.cancellation.refundPercent}% refund`} />
                <InfoRow label="Refund Amount"     value={inr(b.cancellation.refundAmount)} accent="text-black font-bold font-mono" />
                <InfoRow label="Refund Status"     value={b.cancellation.refundStatus.replace(/_/g," ")} />
                {b.cancellation.refundedAt&&<InfoRow label="Refunded At" value={fmtDT(b.cancellation.refundedAt)}/>}
                {b.cancellation.reason&&(
                  <div className="mt-5 rounded-xl bg-gray-50 border border-gray-200 p-4">
                    <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">Reason</p>
                    <p className="text-sm text-gray-600 leading-relaxed">{b.cancellation.reason}</p>
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <SectionLabel color="bg-gray-600">Refund Timeline</SectionLabel>
                <div className="relative pl-8 space-y-7 mt-4">
                  <div className="absolute left-4 top-1 bottom-0 w-0.5 bg-gray-200 rounded-full"/>
                  {[
                    {label:"Cancellation Requested",sub:"Booking cancelled",  time:b.cancellation.cancelledAt, done:true},
                    {label:"Refund Initiated",       sub:"Processing started", time:null,                        done:b.cancellation.refundStatus==="PROCESSED"},
                    {label:"Refund Processed",       sub:"Amount credited",    time:b.cancellation.refundedAt,   done:b.cancellation.refundStatus==="PROCESSED"},
                  ].map((step,i)=>(
                    <div key={i} className="relative flex items-start gap-4">
                      <div className={`absolute -left-8 w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold mt-0.5 ${step.done?"bg-gray-700 border-gray-700 text-white":"bg-white border-gray-300 text-gray-400"}`}>
                        {step.done?"✓":i+1}
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${step.done?"text-black":"text-gray-500"}`}>{step.label}</p>
                        <p className={`text-xs mt-0.5 ${step.done?"text-gray-500":"text-gray-400"}`}>{step.sub}</p>
                        {step.time&&step.done&&<p className="text-xs text-gray-400 mt-1 font-mono">{fmtDT(step.time)}</p>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-8 rounded-xl bg-gray-50 border border-gray-200 px-4 py-4 flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-600 font-semibold">Refund Amount</p>
                    <p className="text-xs text-gray-400 mt-1">{b.cancellation.refundPercent}% of {inr(b.totalAmount)}</p>
                  </div>
                  <span className="text-2xl font-bold text-black font-mono">{inr(b.cancellation.refundAmount)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Bookings() {
  const [shows,    setShows]    = useState<ShowOption[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats,    setStats]    = useState<Stats | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const [selectedShow, setSelectedShow] = useState<string>("");
  const [filterTab,    setFilterTab]    = useState<FilterTab>("all");
  const [timePeriod,   setTimePeriod]   = useState<TimePeriod>("full");
  const [search,       setSearch]       = useState("");
  const [expanded,     setExpanded]     = useState<string | null>(null);

  const loadShows = useCallback(async () => {
    try { const res = await API.get("/api/bookings/shows"); setShows(res.data.data ?? []); } catch {}
  }, []);

  const loadBookings = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = selectedShow ? { showId: selectedShow } : {};
      const res = await API.get("/api/bookings", { params });
      const list: Booking[] = res.data.data ?? [];
      setBookings(list);
      if (selectedShow) {
        const sRes = await API.get("/api/bookings/stats", { params: { showId: selectedShow } });
        setStats(sRes.data.data ?? null);
      } else {
        const conf=list.filter(b=>b.status==="CONFIRMED"), canc=list.filter(b=>b.status==="CANCELLED");
        const pend=list.filter(b=>["PENDING","SEATS_SELECTED"].includes(b.status));
        const rev=conf.reduce((s,b)=>s+b.totalAmount,0), ref=canc.reduce((s,b)=>s+(b.cancellation?.refundAmount??0),0);
        setStats({confirmedBookings:conf.length,cancelledBookings:canc.length,pendingBookings:pend.length,totalBookings:list.length,totalRevenue:rev,totalRefunded:ref,netRevenue:rev-ref});
      }
    } catch(e:any) { setError(e.response?.data?.message||"Failed to load bookings"); }
    finally { setLoading(false); }
  }, [selectedShow]);

  useEffect(() => { loadShows(); }, [loadShows]);
  useEffect(() => { loadBookings(); }, [loadBookings]);

  const filtered = bookings.filter(b => {
    const tabOk = filterTab==="all"?true:filterTab==="confirmed"?b.status==="CONFIRMED":filterTab==="cancelled"?b.status==="CANCELLED":["PENDING","SEATS_SELECTED"].includes(b.status);
    const q=search.trim().toLowerCase();
    const searchOk=!q||[b.bookerName,b.bookingRef,b.bookerPhone,b.bookerEmail,b.show.title,b.show.city].some(f=>f.toLowerCase().includes(q))||b.seats.some(s=>s.seat.seatCode.toLowerCase().includes(q));
    return tabOk&&searchOk&&new Date(b.createdAt)>=periodStart(timePeriod);
  });

  const counts: Record<FilterTab, number> = {
    all:       bookings.length,
    confirmed: bookings.filter(b=>b.status==="CONFIRMED").length,
    cancelled: bookings.filter(b=>b.status==="CANCELLED").length,
    pending:   bookings.filter(b=>["PENDING","SEATS_SELECTED"].includes(b.status)).length,
  };

  return (
    <div className="min-h-screen bg-white text-black" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-[1400px] mx-auto px-6 sm:px-8 py-8 sm:py-10 space-y-8">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div>
            <h1 className="text-3xl font-bold text-black tracking-tight">Bookings</h1>
            <p className="text-sm text-gray-500 mt-1.5">
              {selectedShow ? `Showing: ${shows.find(s=>s.id===selectedShow)?.title ?? "Selected show"}` : "All bookings across your shows"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button onClick={()=>exportCSV(filtered,timePeriod)} disabled={filtered.length===0}
              className="px-4 py-2.5 rounded-xl bg-gray-100 border border-gray-200 text-sm text-gray-700 hover:bg-gray-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              Export CSV
            </button>
            <button onClick={()=>exportPDF(filtered,timePeriod,shows.find(s=>s.id===selectedShow)?.title)} disabled={filtered.length===0}
              className="px-4 py-2.5 rounded-xl bg-black text-white text-sm font-medium hover:bg-gray-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              Export PDF
            </button>
            <button onClick={loadBookings} disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 border border-gray-200 text-sm text-gray-700 hover:bg-gray-200 transition-all disabled:opacity-40">
              <svg className={`w-4 h-4 ${loading?"animate-spin":""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="rounded-2xl bg-red-50 border border-red-200 px-5 py-4 flex items-start gap-3.5">
            <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-700">Failed to load bookings</p>
              <p className="text-sm text-red-600 mt-0.5">{error}</p>
            </div>
            <button onClick={loadBookings} className="text-sm text-red-600 hover:text-red-800 underline shrink-0">Retry</button>
          </div>
        )}

        {/* ── Stats ── */}
        {stats && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard icon="📋" label="Total"       value={stats.totalBookings} />
            <StatCard icon="✅" label="Confirmed"   value={stats.confirmedBookings} />
            <StatCard icon="⏳" label="Pending"     value={stats.pendingBookings} />
            <StatCard icon="💰" label="Net Revenue" value={inr(stats.netRevenue)} sub={stats.totalRefunded>0?`${inr(stats.totalRefunded)} refunded`:undefined} />
            <StatCard icon="❌" label="Cancelled"   value={stats.cancelledBookings} />
          </div>
        )}

        {/* ── Filter Bar ── */}
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 px-5 py-4 rounded-2xl bg-gray-50 border border-gray-200">
          <div className="relative w-full sm:w-64">
            <select value={selectedShow} onChange={e=>{setSelectedShow(e.target.value);setExpanded(null);}}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 pr-9 py-2.5 text-sm text-black focus:outline-none focus:border-gray-400 appearance-none cursor-pointer">
              <option value="">All Shows</option>
              {shows.map(s=><option key={s.id} value={s.id}>{s.title} — {fmtDate(s.date)}</option>)}
            </select>
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>
          </div>

          <div className="relative w-full sm:w-48">
            <select value={timePeriod} onChange={e=>setTimePeriod(e.target.value as TimePeriod)}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 pr-9 py-2.5 text-sm text-black focus:outline-none focus:border-gray-400 appearance-none cursor-pointer">
              <option value="full">All Time</option><option value="today">Today</option>
              <option value="week">Last 7 Days</option><option value="2weeks">Last 14 Days</option>
              <option value="month">Last 30 Days</option><option value="3months">Last 3 Months</option>
              <option value="6months">Last 6 Months</option><option value="thisyear">This Year</option>
            </select>
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>
          </div>

          <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1">
            {(["all","confirmed","pending","cancelled"] as FilterTab[]).map(t=>(
              <button key={t} onClick={()=>setFilterTab(t)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${filterTab===t?"bg-black text-white shadow-sm":"text-gray-600 hover:text-black hover:bg-gray-100"}`}>
                {t}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${filterTab===t?"bg-white/20 text-white":"bg-gray-100 text-gray-500"}`}>{counts[t]}</span>
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input type="text" placeholder="Search name, ref, seat, phone…" value={search} onChange={e=>setSearch(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-9 py-2.5 text-sm text-black placeholder-gray-400 focus:outline-none focus:border-gray-400"/>
            {search&&(
              <button onClick={()=>setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* ── Table ── */}
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-28 text-gray-500">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <span className="text-sm">Loading bookings…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-28 text-gray-500">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center mb-5">
                <svg className="w-7 h-7 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-700">No bookings found</p>
              <p className="text-xs text-gray-400 mt-2">{bookings.length===0?"No bookings recorded yet":"Try adjusting your filters"}</p>
              {(search||selectedShow||filterTab!=="all"||timePeriod!=="full")&&(
                <button onClick={()=>{setSearch("");setSelectedShow("");setFilterTab("all");setTimePeriod("full");}} className="mt-5 text-sm text-gray-600 hover:text-black underline">
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-max">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    {["","Ref","Booker","Show","Seats","Amount","Status","Tx","Refund","Date"].map((h,i)=>(
                      <th key={i} className="text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4 py-4 whitespace-nowrap first:pl-5 last:pr-5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(b => (
                    /**
                     * ✅ KEY FIX — the root cause of the warning:
                     *
                     * BEFORE (broken):
                     *   <>               ← shorthand Fragment has NO key prop
                     *     <tr key={b.id} ← key on the inner element is ignored by React
                     *     ...
                     *   </>
                     *
                     * AFTER (correct):
                     *   <React.Fragment key={b.id}>   ← key lives on the Fragment
                     *     <tr>                         ← no key needed here anymore
                     *     ...
                     *   </React.Fragment>
                     *
                     * React tracks the Fragment as the list item, so it knows which
                     * <tr> + optional expanded <tr> pair belong to each booking.
                     */
                    <React.Fragment key={b.id}>
                      <tr
                        onClick={() => setExpanded(p => p === b.id ? null : b.id)}
                        className={`border-b border-gray-100 cursor-pointer transition-colors duration-100 ${expanded === b.id ? "bg-gray-50" : "hover:bg-gray-50/80"}`}
                      >
                        <td className="pl-5 py-4 w-8">
                          <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-150 ${expanded===b.id?"rotate-90":""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                          </svg>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="font-mono text-sm font-semibold text-gray-700">{b.bookingRef}</span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-gray-600">{b.bookerName[0].toUpperCase()}</span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-black leading-tight">{b.bookerName}</p>
                              <p className="text-xs text-gray-500 font-mono mt-0.5">{b.bookerPhone}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 max-w-[180px]">
                          <p className="text-sm font-medium text-black truncate">{b.show.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{fmtDate(b.show.date)} · {b.show.city}</p>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {b.seats.slice(0,3).map(bs=>(
                              <span key={bs.seat.seatCode} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono bg-gray-100 text-gray-700 border border-gray-200">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor:bs.category.color}}/>
                                {bs.seat.seatCode}
                              </span>
                            ))}
                            {b.seats.length>3&&<span className="text-xs text-gray-400 self-center">+{b.seats.length-3}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="text-sm font-bold text-black font-mono">{inr(b.totalAmount)}</span>
                        </td>
                        <td className="px-4 py-4"><Badge v={b.status}/></td>
                        <td className="px-4 py-4">
                          {b.transaction?<Badge v={b.transaction.status}/>:<span className="text-gray-300 text-sm">—</span>}
                        </td>
                        <td className="px-4 py-4">
                          {b.cancellation?<Badge v={b.cancellation.refundStatus}/>:<span className="text-gray-300 text-sm">—</span>}
                        </td>
                        <td className="px-4 py-4 pr-5 whitespace-nowrap text-sm text-gray-500">{fmtDate(b.createdAt)}</td>
                      </tr>

                      {expanded === b.id && (
                        <tr>
                          <td colSpan={10} className="p-0">
                            <DetailPanel b={b} onClose={() => setExpanded(null)} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {!loading && !error && bookings.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-gray-500 pb-2">
            <p>
              Showing <span className="font-semibold text-black">{filtered.length}</span> of{" "}
              <span className="font-semibold text-black">{bookings.length}</span> bookings
            </p>
            {filtered.length !== bookings.length && (
              <button onClick={()=>{setSearch("");setFilterTab("all");setTimePeriod("full");}} className="text-sm text-gray-500 hover:text-black underline transition-colors">
                Clear filters
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}