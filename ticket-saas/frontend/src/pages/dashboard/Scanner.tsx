import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import jsQR from "jsqr"; // npm install jsqr

// ─── Types ────────────────────────────────────────────────────────────────────
interface Show {
  id: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  city: string;
}

interface ScanStats {
  totalBookings: number;
  checkedIn: number;
  pending: number;
  cancelled: number;
  invalidScans: number;
}

interface BookingPayload {
  bookingRef: string;
  bookerName: string;
  bookerPhone: string;
  bookerEmail: string;
  quantity: number;
  totalAmount: number;
  status: string;
  seats: string[];
  show: { title: string; date: string; time: string; venue: string };
}

interface VerifyResult {
  valid: boolean;
  reason?: string;
  booking?: BookingPayload;
  bookingRef: string;
}

interface ScanLogEntry {
  id: string;
  isValid: boolean;
  invalidReason?: string;
  scannedAt: string;
  booking: {
    bookingRef: string;
    bookerName: string;
    quantity: number;
    seats: string[];
  };
}

// ─── API ──────────────────────────────────────────────────────────────────────
const API_BASE = (import.meta as any).env?.VITE_API_URL ?? "/api";

function getToken() {
  return localStorage.getItem("token") ?? "";
}

function getName() {
  try {
    const payload = JSON.parse(atob(getToken().split(".")[1]));
    return payload.name ?? payload.email ?? "Validator";
  } catch {
    return "Validator";
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(options?.headers ?? {}),
    },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message ?? "Request failed");
  return json.data as T;
}

// ─── QR Scanner Hook ──────────────────────────────────────────────────────────
function useQRScanner(onScan: (data: string) => void, active: boolean) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef    = useRef<CanvasRenderingContext2D | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef    = useRef<number>(0);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const tick = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    if (!ctxRef.current) {
      ctxRef.current = canvas.getContext("2d", { willReadFrequently: true });
    }
    const ctx = ctxRef.current;
    if (!ctx) { rafRef.current = requestAnimationFrame(tick); return; }

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code?.data) { onScan(code.data); return; }
    rafRef.current = requestAnimationFrame(tick);
  }, [onScan]);

  useEffect(() => {
    if (!active) return;
    setCameraError(null);
    ctxRef.current = null;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          rafRef.current = requestAnimationFrame(tick);
        }
      } catch (e: any) {
        if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
          setCameraError("Camera permission denied. Please allow camera access and try again.");
        } else if (e.name === "NotFoundError") {
          setCameraError("No camera found on this device.");
        } else {
          setCameraError(`Camera error: ${e.message}`);
        }
      }
    };

    start();
    return () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      ctxRef.current    = null;
    };
  }, [active, tick]);

  return { videoRef, canvasRef, cameraError };
}

// ─── Reason labels ────────────────────────────────────────────────────────────
const REASON: Record<string, string> = {
  BOOKING_NOT_FOUND:  "Booking not found",
  SHOW_MISMATCH:      "Wrong event",
  BOOKING_CANCELLED:  "Booking was cancelled",
  ALREADY_CHECKED_IN: "Already checked in",
  NOT_CONFIRMED:      "Booking not confirmed",
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Epilogue:wght@400;600;700;800;900&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --white: #FFFFFF;
    --light: #E5E5E5;
    --mid:   #AFAFAF;
    --dark:  #4A4A4A;
    --black: #000000;
    --ff: 'Epilogue', sans-serif;
    --fm: 'DM Mono', monospace;
  }

  html, body {
    margin: 0; padding: 0; width: 100%; height: 100%;
    overflow-x: hidden;
    background: #F4F4F4;
    color: var(--black);
    font-family: var(--ff);
    -webkit-font-smoothing: antialiased;
  }

  /* ── Page shell ─────────────────────────────────────────── */
  .sc-page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: #F4F4F4;
  }

  /* ── Top navbar (all screens) ───────────────────────────── */
  .sc-nav {
    background: var(--black);
    padding: 0 24px;
    height: 56px;
    display: flex;
    align-items: center;
    gap: 14px;
    position: sticky;
    top: 0;
    z-index: 50;
    flex-shrink: 0;
  }
  .sc-nav-mark {
    width: 32px; height: 32px; flex-shrink: 0;
    border: 1.5px solid rgba(255,255,255,0.18); border-radius: 7px;
    display: flex; align-items: center; justify-content: center; font-size: 15px;
  }
  .sc-nav-title {
    font-size: 13px; font-weight: 900; letter-spacing: .1em;
    text-transform: uppercase; color: var(--white);
  }
  .sc-nav-sub {
    font-size: 10px; color: rgba(255,255,255,0.35);
    font-family: var(--fm); margin-top: 1px;
    max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .sc-nav-right {
    margin-left: auto;
    display: flex; align-items: center; gap: 10px;
  }
  .sc-nav-user {
    font-size: 11px; font-family: var(--fm);
    color: rgba(255,255,255,0.45); letter-spacing: .04em;
    white-space: nowrap;
    /* hide on very small screens */
  }
  .sc-nav-pill {
    display: flex; align-items: center; gap: 5px;
    font-size: 10px; font-family: var(--fm); color: var(--white);
    border: 1px solid rgba(255,255,255,0.18);
    padding: 4px 10px; border-radius: 4px; letter-spacing: .06em;
    white-space: nowrap;
  }
  .sc-nav-signout {
    font-size: 11px; font-family: var(--fm); font-weight: 700;
    letter-spacing: .07em; text-transform: uppercase;
    color: var(--black); background: var(--white);
    border: none; border-radius: 5px;
    padding: 6px 12px; cursor: pointer;
    transition: background .15s, color .15s;
    white-space: nowrap;
  }
  .sc-nav-signout:hover { background: var(--light); }
  .sc-pulse {
    width: 6px; height: 6px; border-radius: 50%; background: var(--white);
    animation: sc-pulse 1.6s ease-in-out infinite;
  }
  @keyframes sc-pulse { 0%,100%{opacity:1} 50%{opacity:.2} }

  /* hide username on tiny phones */
  @media (max-width: 400px) { .sc-nav-user { display: none; } }

  /* ── Content area ───────────────────────────────────────── */
  .sc-content {
    flex: 1;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
  }

  /* ── Event + stats row ──────────────────────────────────── */
  .sc-top-row {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  @media (min-width: 640px) {
    .sc-top-row {
      flex-direction: row;
      align-items: flex-end;
      gap: 12px;
    }
    .sc-select-wrap { flex: 1; }
  }

  /* ── Event selector ─────────────────────────────────────── */
  .sc-select-wrap {
    border: 1px solid var(--light); border-radius: 10px;
    padding: 12px 14px; background: var(--white);
  }
  .sc-field-label {
    font-size: 10px; font-family: var(--fm); color: var(--mid);
    letter-spacing: .1em; text-transform: uppercase; display: block; margin-bottom: 6px;
  }
  .sc-select {
    width: 100%; background: var(--white); border: 1px solid var(--light);
    border-radius: 6px; color: var(--black); padding: 9px 11px;
    font-family: var(--ff); font-size: 14px; font-weight: 600;
    appearance: none; cursor: pointer;
  }
  .sc-select:focus { outline: none; border-color: var(--dark); }
  .sc-select:disabled { opacity: .45; }

  /* ── Stats ──────────────────────────────────────────────── */
  .sc-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  /* on very small phones, 2×2 grid */
  @media (max-width: 380px) {
    .sc-stats { grid-template-columns: repeat(2, 1fr); }
  }
  .sc-stat {
    background: var(--white); border: 1px solid var(--light);
    border-radius: 10px; padding: 12px 8px; text-align: center;
  }
  .sc-stat.s-in  { background: var(--black); border-color: var(--black); }
  .sc-stat.s-bad { background: var(--light); border-color: var(--light); }
  .sc-stat-n {
    font-size: 26px; font-weight: 900; font-family: var(--fm);
    line-height: 1; color: var(--dark);
  }
  .sc-stat.s-in  .sc-stat-n { color: var(--white); }
  .sc-stat.s-bad .sc-stat-n { color: var(--black); }
  .sc-stat-l {
    font-size: 9px; color: var(--mid); text-transform: uppercase;
    letter-spacing: .07em; margin-top: 5px; font-family: var(--fm);
  }
  .sc-stat.s-in .sc-stat-l  { color: rgba(255,255,255,.4); }
  .sc-stat.s-bad .sc-stat-l { color: var(--dark); }

  /* ── Main two-column layout (desktop/tablet) ────────────── */
  .sc-main {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
  }
  @media (min-width: 900px) {
    .sc-main {
      flex-direction: row;
      align-items: flex-start;
    }
    .sc-col-left  { width: 420px; flex-shrink: 0; }
    .sc-col-right { flex: 1; min-width: 0; }
  }
  @media (min-width: 640px) and (max-width: 899px) {
    /* Tablet: camera card is narrower, log fills rest */
    .sc-main {
      flex-direction: row;
      align-items: flex-start;
    }
    .sc-col-left  { width: 340px; flex-shrink: 0; }
    .sc-col-right { flex: 1; min-width: 0; }
  }

  /* ── Card ───────────────────────────────────────────────── */
  .sc-card {
    background: var(--white); border: 1px solid var(--light);
    border-radius: 12px; overflow: hidden;
  }
  .sc-card-head {
    padding: 12px 15px; border-bottom: 1px solid var(--light);
    display: flex; align-items: center; justify-content: space-between;
  }
  .sc-card-head-title {
    font-size: 11px; font-weight: 700; letter-spacing: .08em;
    text-transform: uppercase; color: var(--dark);
  }

  /* ── Tabs (mobile only — on desktop both panels visible) ── */
  .sc-tabs { display: flex; background: var(--white); border-bottom: 1px solid var(--light); }
  @media (min-width: 640px) { .sc-tabs { display: none; } }
  .sc-tab {
    flex: 1; padding: 12px 6px;
    font-family: var(--ff); font-size: 11px; font-weight: 700;
    letter-spacing: .09em; text-transform: uppercase;
    color: var(--mid); cursor: pointer;
    border: none; background: none; border-bottom: 2px solid transparent;
    transition: color .15s, border-color .15s;
  }
  .sc-tab.active { color: var(--black); border-bottom-color: var(--black); }

  /* ── Camera viewport ────────────────────────────────────── */
  .sc-viewport {
    position: relative; width: 100%; aspect-ratio: 1;
    background: var(--black); overflow: hidden;
    display: flex; align-items: center; justify-content: center;
  }
  .sc-viewport video  { width: 100%; height: 100%; object-fit: cover; }
  .sc-viewport canvas { display: none; }

  /* Scan frame corners */
  .sc-frame-wrap {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    pointer-events: none;
  }
  .sc-frame { width: 200px; height: 200px; position: relative; }
  .sc-frame::before, .sc-frame::after,
  .sc-frame > span::before, .sc-frame > span::after {
    content: ''; position: absolute;
    width: 24px; height: 24px; border-color: var(--white); border-style: solid;
  }
  .sc-frame::before        { top:0;    left:0;  border-width: 3px 0 0 3px; }
  .sc-frame::after         { top:0;    right:0; border-width: 3px 3px 0 0; }
  .sc-frame > span::before { bottom:0; left:0;  border-width: 0 0 3px 3px; }
  .sc-frame > span::after  { bottom:0; right:0; border-width: 0 3px 3px 0; }
  .sc-scanline {
    position: absolute; left: 8px; right: 8px; height: 2px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.9) 40%, rgba(255,255,255,0.9) 60%, transparent);
    animation: sc-scan 2s ease-in-out infinite;
  }
  @keyframes sc-scan { 0%{top:8px} 50%{top:calc(100% - 8px)} 100%{top:8px} }

  .sc-idle {
    position: absolute; inset: 0; background: var(--light);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
  }
  .sc-idle-icon { font-size: 44px; opacity: .2; }
  .sc-idle-text {
    font-size: 12px; color: var(--mid); font-family: var(--fm);
    text-align: center; padding: 0 32px; line-height: 1.8;
  }

  .sc-scan-status {
    padding: 8px 15px; background: var(--black);
    color: rgba(255,255,255,0.55); font-size: 10px;
    font-family: var(--fm); letter-spacing: .1em; text-transform: uppercase;
    display: flex; align-items: center; gap: 8px;
  }

  /* Buttons */
  .sc-btn-row { padding: 12px; }
  .sc-btn {
    width: 100%; padding: 13px;
    font-family: var(--ff); font-size: 12px; font-weight: 800;
    letter-spacing: .1em; text-transform: uppercase;
    border-radius: 7px; cursor: pointer; border: none; transition: all .15s;
  }
  .sc-btn-primary { background: var(--black); color: var(--white); }
  .sc-btn-primary:hover:not(:disabled) { background: var(--dark); }
  .sc-btn-ghost { background: var(--white); color: var(--dark); border: 1.5px solid var(--light); }
  .sc-btn-ghost:hover { border-color: var(--dark); }
  .sc-btn:disabled { opacity: .35; cursor: not-allowed; }

  .sc-error {
    margin: 12px; padding: 11px 14px;
    background: var(--light); border: 1.5px solid var(--dark);
    border-radius: 7px; font-size: 11px; color: var(--black);
    font-family: var(--fm); text-align: center; line-height: 1.6;
  }

  /* ── Log panel ──────────────────────────────────────────── */
  /* Mobile: capped height; desktop: fills full height */
  .sc-log-list { overflow-y: auto; max-height: 400px; }
  @media (min-width: 640px) { .sc-log-list { max-height: 600px; } }
  @media (min-width: 900px) { .sc-log-list { max-height: calc(100vh - 200px); } }

  .sc-log-item {
    display: flex; align-items: center; gap: 10px;
    padding: 11px 15px; border-bottom: 1px solid var(--light);
    transition: background .1s;
  }
  .sc-log-item:last-child { border-bottom: none; }
  .sc-log-item:hover { background: #fafafa; }
  .sc-log-indicator {
    width: 30px; height: 30px; border-radius: 7px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 800; font-family: var(--fm);
  }
  .sc-log-indicator.ok  { background: var(--black); color: var(--white); }
  .sc-log-indicator.bad { background: var(--light); color: var(--dark); }
  .sc-log-info { flex: 1; min-width: 0; }
  .sc-log-name { font-size: 13px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sc-log-ref  { font-family: var(--fm); font-size: 10px; color: var(--mid); margin-top: 1px; }
  .sc-log-right { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; }
  .sc-log-badge { font-size: 10px; font-family: var(--fm); padding: 2px 8px; border-radius: 4px; white-space: nowrap; }
  .sc-log-badge.ok  { background: var(--black); color: var(--white); }
  .sc-log-badge.bad { background: var(--light); color: var(--dark); }
  .sc-log-time { font-family: var(--fm); font-size: 10px; color: var(--mid); }
  .sc-log-empty {
    padding: 48px 20px; text-align: center;
    color: var(--mid); font-family: var(--fm); font-size: 12px; line-height: 1.8;
  }

  /* ── Mobile tab visibility ──────────────────────────────── */
  /* On mobile, only show the active tab panel */
  @media (max-width: 639px) {
    .sc-col-left.tab-hidden  { display: none; }
    .sc-col-right.tab-hidden { display: none; }
  }

  /* ── Verifying overlay ──────────────────────────────────── */
  .sc-verifying-bg {
    position: fixed; inset: 0; z-index: 100;
    background: rgba(0,0,0,0.65);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 14px;
    animation: sc-fadein .18s ease;
  }
  .sc-spinner {
    width: 46px; height: 46px;
    border: 3px solid rgba(255,255,255,.12); border-top-color: var(--white);
    border-radius: 50%; animation: sc-spin .72s linear infinite;
  }
  @keyframes sc-spin   { to { transform: rotate(360deg); } }
  @keyframes sc-fadein { from{opacity:0} to{opacity:1} }
  .sc-verifying-ref {
    font-family: var(--fm); font-size: 15px;
    color: var(--white); font-weight: 700; letter-spacing: .05em;
  }
  .sc-verifying-lbl {
    font-family: var(--fm); font-size: 10px;
    color: rgba(255,255,255,.4); letter-spacing: .14em; text-transform: uppercase;
  }

  /* ── Result sheet ───────────────────────────────────────── */
  .sc-result-bg {
    position: fixed; inset: 0; z-index: 100;
    background: rgba(0,0,0,0.5);
    display: flex; align-items: flex-end; justify-content: center;
    animation: sc-fadein .18s ease;
  }
  /* On desktop, center as a modal instead of bottom sheet */
  @media (min-width: 640px) {
    .sc-result-bg { align-items: center; }
    .sc-result-sheet {
      border-radius: 16px !important;
      max-width: 480px !important;
      margin: 20px;
    }
    @keyframes sc-slideup { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }
  }
  .sc-result-sheet {
    width: 100%; max-width: 440px; background: var(--white);
    border-radius: 16px 16px 0 0;
    padding: 26px 22px 44px;
    animation: sc-slideup .3s cubic-bezier(.16,1,.3,1);
  }
  @keyframes sc-slideup { from{transform:translateY(100%)} to{transform:translateY(0)} }
  .sc-result-sheet.ok  { border-top: 3px solid var(--black); }
  .sc-result-sheet.bad { border-top: 3px solid var(--light); }

  .sc-result-strip { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
  .sc-result-icon-box {
    width: 56px; height: 56px; border-radius: 11px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; font-weight: 900; font-family: var(--fm);
  }
  .sc-result-sheet.ok  .sc-result-icon-box { background: var(--black); color: var(--white); }
  .sc-result-sheet.bad .sc-result-icon-box { background: var(--light); color: var(--dark); }
  .sc-result-heading { font-size: 22px; font-weight: 900; letter-spacing: .01em; }
  .sc-result-sheet.ok  .sc-result-heading { color: var(--black); }
  .sc-result-sheet.bad .sc-result-heading { color: var(--dark); }
  .sc-result-ref { font-size: 11px; font-family: var(--fm); color: var(--mid); margin-top: 3px; }

  .sc-divider { height: 1px; background: var(--light); margin-bottom: 16px; }

  .sc-result-rows {
    border: 1px solid var(--light); border-radius: 9px;
    overflow: hidden; margin-bottom: 16px;
  }
  .sc-result-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 11px 14px; border-bottom: 1px solid var(--light);
  }
  .sc-result-row:last-child { border-bottom: none; }
  .sc-result-row-l {
    font-size: 10px; font-family: var(--fm); color: var(--mid);
    text-transform: uppercase; letter-spacing: .08em;
  }
  .sc-result-row-v {
    font-size: 13px; font-weight: 700; color: var(--black);
    font-family: var(--fm); text-align: right; max-width: 240px;
  }
  .sc-result-reason {
    padding: 14px; background: var(--light); border-radius: 8px;
    margin-bottom: 16px; text-align: center;
  }
  .sc-result-reason strong {
    display: block; font-size: 10px; font-family: var(--fm);
    text-transform: uppercase; letter-spacing: .1em; color: var(--dark); margin-bottom: 5px;
  }
  .sc-result-reason span { font-size: 14px; font-weight: 700; color: var(--black); }
`;

// ─── Component ────────────────────────────────────────────────────────────────
export default function Scanner() {
  const navigate = useNavigate();

  const [tab, setTab]               = useState<"scan" | "log">("scan");
  const [shows, setShows]           = useState<Show[]>([]);
  const [showId, setShowId]         = useState("");
  const [stats, setStats]           = useState<ScanStats | null>(null);
  const [scanActive, setScanActive] = useState(false);
  const [verifying, setVerifying]   = useState<string | null>(null);
  const [result, setResult]         = useState<VerifyResult | null>(null);
  const [log, setLog]               = useState<ScanLogEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const lastScannedRef              = useRef("");

  // ── Sign out ─────────────────────────────────────────────────────────────
  const handleSignOut = () => {
    localStorage.removeItem("token");
    // also clear any other auth keys your app uses
    sessionStorage.clear();
    navigate("/login");
  };

  // ── Load shows on mount ──────────────────────────────────────────────────
  useEffect(() => {
    apiFetch<Show[]>("/scanner/shows")
      .then((d) => { setShows(d); if (d.length) setShowId(d[0].id); })
      .finally(() => setLoading(false));
  }, []);

  // ── Stats + history when show changes ────────────────────────────────────
  useEffect(() => {
    if (!showId) return;
    apiFetch<ScanStats>(`/scanner/stats?showId=${showId}`).then(setStats).catch(() => {});
    apiFetch<ScanLogEntry[]>(`/scanner/history?showId=${showId}&limit=100`).then(setLog).catch(() => {});
  }, [showId]);

  // ── Poll stats every 15 s ────────────────────────────────────────────────
  useEffect(() => {
    if (!showId) return;
    const id = setInterval(() => {
      apiFetch<ScanStats>(`/scanner/stats?showId=${showId}`).then(setStats).catch(() => {});
    }, 15_000);
    return () => clearInterval(id);
  }, [showId]);

  // ── Verify ───────────────────────────────────────────────────────────────
  const processVerify = useCallback(async (raw: string) => {
    // QR format: TICKET:{bookingRef}:{showId}
    // e.g. "TICKET:BK-81D40DEC:217DE18E-AA0E-4197-B66C-B25F7CFB1C52"
    const raw_upper = raw.trim().toUpperCase();
    const parts = raw_upper.split(":");
    const bookingRef = parts[0] === "TICKET" && parts.length >= 2
      ? parts[1]   // take the bookingRef segment
      : parts[0];  // plain bookingRef with no prefix

    if (!showId) return;

    setScanActive(false);
    setVerifying(bookingRef);
    setResult(null);

    try {
      const data = await apiFetch<Omit<VerifyResult, "bookingRef">>("/scanner/verify", {
        method: "POST",
        body: JSON.stringify({ bookingRef, showId }),
      });

      setResult({ ...data, bookingRef });

      setLog((prev) => [{
        id:            Date.now().toString(),
        isValid:       data.valid,
        invalidReason: data.reason,
        scannedAt:     new Date().toISOString(),
        booking: {
          bookingRef,
          bookerName: data.booking?.bookerName ?? "Unknown",
          quantity:   data.booking?.quantity   ?? 0,
          seats:      data.booking?.seats      ?? [],
        },
      }, ...prev]);

      setStats((prev) => {
        if (!prev) return prev;
        return data.valid
          ? { ...prev, checkedIn: prev.checkedIn + 1, pending: Math.max(0, prev.pending - 1) }
          : { ...prev, invalidScans: prev.invalidScans + 1 };
      });

    } catch (e: any) {
      setResult({ valid: false, reason: e.message ?? "NETWORK_ERROR", bookingRef });
    } finally {
      setVerifying(null);
    }
  }, [showId]);

  const handleScan = useCallback((data: string) => {
    if (data === lastScannedRef.current) return;
    lastScannedRef.current = data;
    processVerify(data);
    setTimeout(() => { lastScannedRef.current = ""; }, 4000);
  }, [processVerify]);

  const { videoRef, canvasRef, cameraError } = useQRScanner(handleScan, scanActive);

  const resetScan = () => { setResult(null); setScanActive(true); };
  const currentShow = shows.find((s) => s.id === showId);

  // ── Camera panel (reused in both mobile and desktop) ─────────────────────
  const CameraPanel = (
    <div className="sc-card">
      <div className="sc-card-head">
        <span className="sc-card-head-title">Camera</span>
        {scanActive && <div className="sc-pulse" />}
      </div>

      <div className="sc-viewport">
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ display: scanActive ? "block" : "none" }}
        />
        <canvas ref={canvasRef} />

        {scanActive && (
          <div className="sc-frame-wrap">
            <div className="sc-frame">
              <span />
              <div className="sc-scanline" />
            </div>
          </div>
        )}

        {!scanActive && (
          <div className="sc-idle">
            <div className="sc-idle-icon">📷</div>
            <p className="sc-idle-text">
              Tap Open Scanner to activate the camera and scan a ticket QR code
            </p>
          </div>
        )}
      </div>

      {scanActive && (
        <div className="sc-scan-status">
          <div className="sc-pulse" />
          Scanning for QR code…
        </div>
      )}

      {cameraError && <div className="sc-error">{cameraError}</div>}

      <div className="sc-btn-row">
        {!scanActive ? (
          <button
            className="sc-btn sc-btn-primary"
            disabled={!showId}
            onClick={() => { setResult(null); setScanActive(true); }}
          >
            Open Scanner
          </button>
        ) : (
          <button className="sc-btn sc-btn-ghost" onClick={() => setScanActive(false)}>
            Stop Scanner
          </button>
        )}
      </div>
    </div>
  );

  // ── Log panel ─────────────────────────────────────────────────────────────
  const LogPanel = (
    <div className="sc-card">
      <div className="sc-card-head">
        <span className="sc-card-head-title">Scan History</span>
        <span style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--mid)" }}>
          {log.length} scans
        </span>
      </div>
      <div className="sc-log-list">
        {log.length === 0 && (
          <div className="sc-log-empty">
            No scans yet for this event.<br />
            Start scanning to see results here.
          </div>
        )}
        {log.map((entry) => (
          <div key={entry.id} className="sc-log-item">
            <div className={`sc-log-indicator ${entry.isValid ? "ok" : "bad"}`}>
              {entry.isValid ? "✓" : "✕"}
            </div>
            <div className="sc-log-info">
              <div className="sc-log-name">{entry.booking.bookerName}</div>
              <div className="sc-log-ref">{entry.booking.bookingRef}</div>
            </div>
            <div className="sc-log-right">
              {entry.isValid ? (
                <span className="sc-log-badge ok">{entry.booking.quantity} tkt</span>
              ) : (
                <span className="sc-log-badge bad">
                  {REASON[entry.invalidReason ?? ""] ?? entry.invalidReason}
                </span>
              )}
              <span className="sc-log-time">
                {new Date(entry.scannedAt).toLocaleTimeString("en-IN", {
                  hour: "2-digit", minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <style>{css}</style>
      <div className="sc-page">

        {/* ── Navbar ── */}
        <nav className="sc-nav">
          <div className="sc-nav-mark">🎫</div>
          <div style={{ minWidth: 0 }}>
            <div className="sc-nav-title">Ticket Scanner</div>
            <div className="sc-nav-sub">{currentShow?.title ?? "Select an event"}</div>
          </div>
          <div className="sc-nav-right">
            <div className="sc-nav-user">{getName()}</div>
            <div className="sc-nav-pill">
              <div className="sc-pulse" /> LIVE
            </div>
            <button className="sc-nav-signout" onClick={handleSignOut}>
              Sign Out
            </button>
          </div>
        </nav>

        {/* ── Content ── */}
        <div className="sc-content">

          {/* Event selector + stats */}
          <div className="sc-top-row">
            <div className="sc-select-wrap">
              <label className="sc-field-label">Event</label>
              <select
                className="sc-select"
                value={showId}
                onChange={(e) => {
                  setShowId(e.target.value);
                  setScanActive(false);
                  setResult(null);
                }}
                disabled={loading}
              >
                {loading && <option>Loading…</option>}
                {shows.map((s) => (
                  <option key={s.id} value={s.id}>{s.title} — {s.city}</option>
                ))}
              </select>
            </div>
          </div>

          {stats && (
            <div className="sc-stats">
              <div className="sc-stat">
                <div className="sc-stat-n">{stats.totalBookings}</div>
                <div className="sc-stat-l">Total</div>
              </div>
              <div className="sc-stat s-in">
                <div className="sc-stat-n">{stats.checkedIn}</div>
                <div className="sc-stat-l">Checked In</div>
              </div>
              <div className="sc-stat">
                <div className="sc-stat-n">{stats.pending}</div>
                <div className="sc-stat-l">Pending</div>
              </div>
              <div className="sc-stat s-bad">
                <div className="sc-stat-n">{stats.invalidScans}</div>
                <div className="sc-stat-l">Invalid</div>
              </div>
            </div>
          )}

          {/* Tabs — mobile only */}
          <div className="sc-tabs">
            <button
              className={`sc-tab ${tab === "scan" ? "active" : ""}`}
              onClick={() => setTab("scan")}
            >
              Scanner
            </button>
            <button
              className={`sc-tab ${tab === "log" ? "active" : ""}`}
              onClick={() => setTab("log")}
            >
              History{log.length > 0 ? ` (${log.length})` : ""}
            </button>
          </div>

          {/* Two-column main area */}
          <div className="sc-main">
            {/* Left col — camera */}
            <div className={`sc-col-left ${tab === "log" ? "tab-hidden" : ""}`}>
              {CameraPanel}
            </div>

            {/* Right col — history log */}
            <div className={`sc-col-right ${tab === "scan" ? "tab-hidden" : ""}`}>
              {LogPanel}
            </div>
          </div>

        </div>

        {/* ── Verifying overlay ── */}
        {verifying && (
          <div className="sc-verifying-bg">
            <div className="sc-spinner" />
            <div className="sc-verifying-ref">{verifying}</div>
            <div className="sc-verifying-lbl">Checking database…</div>
          </div>
        )}

        {/* ── Result sheet / modal ── */}
        {result && (
          <div
            className="sc-result-bg"
            onClick={(e) => e.target === e.currentTarget && resetScan()}
          >
            <div className={`sc-result-sheet ${result.valid ? "ok" : "bad"}`}>

              <div className="sc-result-strip">
                <div className="sc-result-icon-box">
                  {result.valid ? "✓" : "✕"}
                </div>
                <div>
                  <div className="sc-result-heading">
                    {result.valid ? "Ticket Valid" : "Ticket Invalid"}
                  </div>
                  <div className="sc-result-ref">{result.bookingRef}</div>
                </div>
              </div>

              <div className="sc-divider" />

              {result.valid && result.booking && (
                <div className="sc-result-rows">
                  <div className="sc-result-row">
                    <span className="sc-result-row-l">Name</span>
                    <span className="sc-result-row-v">{result.booking.bookerName}</span>
                  </div>
                  <div className="sc-result-row">
                    <span className="sc-result-row-l">Phone</span>
                    <span className="sc-result-row-v">{result.booking.bookerPhone}</span>
                  </div>
                  <div className="sc-result-row">
                    <span className="sc-result-row-l">Tickets</span>
                    <span className="sc-result-row-v">{result.booking.quantity}</span>
                  </div>
                  {result.booking.seats.length > 0 && (
                    <div className="sc-result-row">
                      <span className="sc-result-row-l">Seats</span>
                      <span className="sc-result-row-v">{result.booking.seats.join(", ")}</span>
                    </div>
                  )}
                  <div className="sc-result-row">
                    <span className="sc-result-row-l">Amount Paid</span>
                    <span className="sc-result-row-v">₹{result.booking.totalAmount}</span>
                  </div>
                  <div className="sc-result-row">
                    <span className="sc-result-row-l">Show</span>
                    <span className="sc-result-row-v">{result.booking.show?.title}</span>
                  </div>
                </div>
              )}

              {!result.valid && (
                <div className="sc-result-reason">
                  <strong>Reason</strong>
                  <span>{REASON[result.reason ?? ""] ?? result.reason ?? "Unknown error"}</span>
                </div>
              )}

              <button className="sc-btn sc-btn-primary" onClick={resetScan}>
                {result.valid ? "Next Scan" : "Scan Again"}
              </button>

            </div>
          </div>
        )}

      </div>
    </>
  );
}