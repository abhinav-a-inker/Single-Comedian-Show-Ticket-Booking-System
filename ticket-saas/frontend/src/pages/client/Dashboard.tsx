import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyShowsApi, deleteShowApi } from "../../services/show.api";
import type { Show } from "../../types/show.types";

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const STATUS_COLOR: Record<string, string> = {
  PUBLISHED: "#00D4A1", DRAFT: "#FFB347", CANCELLED: "#FF5555", COMPLETED: "#6C63FF",
};

// ─── QR Modal ─────────────────────────────────────────────────────────────────
const QRModal = ({ show, onClose }: { show: Show; onClose: () => void }) => (
  <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#000000AA", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ background: "#16161E", border: "1px solid #23232F", borderRadius: 20, padding: 32, textAlign: "center", maxWidth: 360, width: "90%" }}>
      <div style={{ fontSize: 11, color: "#00D4A1", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>WhatsApp QR Code</div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: "#E8E8F0", marginBottom: 4 }}>{show.title}</h3>
      <p style={{ fontSize: 12, color: "#555", marginBottom: 20 }}>Users scan this to book via WhatsApp</p>
      {show.qrCode ? (
        <>
          <img src={show.qrCode} alt="QR Code" style={{ width: 200, height: 200, borderRadius: 12, border: "4px solid #fff" }} />
          <div style={{ marginTop: 14, padding: "10px 14px", background: "#0F0F13", borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>WhatsApp Keyword</div>
            <div style={{ fontFamily: "Space Mono", fontSize: 13, color: "#00D4A1" }}>{show.whatsappKeyword}</div>
          </div>
          <a href={show.qrCode} download={`${show.title}-QR.png`} style={{ display: "block", marginTop: 14, padding: "11px", borderRadius: 10, background: "#00D4A1", color: "#000", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
            ↓ Download QR Code
          </a>
        </>
      ) : (
        <div style={{ padding: 20, color: "#555", fontSize: 14 }}>QR code not generated yet</div>
      )}
      <button onClick={onClose} style={{ marginTop: 10, width: "100%", padding: "10px", borderRadius: 10, background: "transparent", border: "1px solid #23232F", color: "#555", cursor: "pointer", fontSize: 13, fontFamily: "DM Sans" }}>
        Close
      </button>
    </div>
  </div>
);

// ─── View Modal ───────────────────────────────────────────────────────────────
const ViewModal = ({ show, onClose }: { show: Show; onClose: () => void }) => (
  <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#000000AA", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ background: "#16161E", border: "1px solid #23232F", borderRadius: 20, padding: 32, maxWidth: 520, width: "90%", maxHeight: "85vh", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: "#00D4A1", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Show Details</div>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: "#E8E8F0" }}>{show.title}</h3>
        </div>
        <span style={{ padding: "4px 12px", borderRadius: 100, fontSize: 11, fontWeight: 700, background: `${STATUS_COLOR[show.status]}22`, color: STATUS_COLOR[show.status] }}>
          {show.status}
        </span>
      </div>

      {show.description && (
        <div style={{ padding: "12px 16px", background: "#0F0F13", borderRadius: 10, marginBottom: 16, fontSize: 13, color: "#888", lineHeight: 1.6 }}>
          {show.description}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        {[
          { label: "Venue", value: show.venue },
          { label: "City", value: show.city },
          { label: "State", value: show.state },
          { label: "Country", value: show.country },
          { label: "Date", value: fmt(show.date) },
          { label: "Time", value: show.time },
          { label: "Total Seats", value: String(show.totalSeats) },
          { label: "Bookings", value: String(show._count.bookings) },
          { label: "Arrangement", value: show.arrangementType },
          { label: "Cancellation", value: show.cancellationAllowed ? "Allowed" : "Not Allowed" },
        ].map((f) => (
          <div key={f.label} style={{ padding: "10px 14px", background: "#0F0F13", borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: "#444", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{f.label}</div>
            <div style={{ fontSize: 13, color: "#C0C0D0", fontWeight: 500 }}>{f.value}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: "#444", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Seat Categories</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {show.seatCategories.map((cat: any) => (
            <div key={cat.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#0F0F13", borderRadius: 8, border: `1px solid ${cat.color}33` }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: cat.color, flexShrink: 0 }} />
              <span style={{ fontWeight: 600, fontSize: 13, color: "#E8E8F0", flex: 1 }}>{cat.name}</span>
              <span style={{ fontSize: 12, color: "#555" }}>Row {cat.fromRow}–{cat.toRow}</span>
              <span style={{ fontFamily: "Space Mono", fontSize: 13, color: "#00D4A1" }}>₹{cat.price.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "10px 14px", background: "#0F0F13", borderRadius: 8, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "#444", marginBottom: 4 }}>WhatsApp Keyword</div>
        <div style={{ fontFamily: "Space Mono", fontSize: 13, color: "#00D4A1" }}>{show.whatsappKeyword}</div>
      </div>

      <button onClick={onClose} style={{ width: "100%", padding: "11px", borderRadius: 10, background: "transparent", border: "1px solid #23232F", color: "#555", cursor: "pointer", fontSize: 13, fontFamily: "DM Sans" }}>
        Close
      </button>
    </div>
  </div>
);

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
const DeleteModal = ({ show, onConfirm, onClose, loading }: { show: Show; onConfirm: () => void; onClose: () => void; loading: boolean }) => (
  <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#000000AA", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ background: "#16161E", border: "1px solid #FF555533", borderRadius: 20, padding: 32, maxWidth: 380, width: "90%", textAlign: "center" }}>
      <div style={{ fontSize: 36, marginBottom: 16 }}>🗑️</div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: "#E8E8F0", marginBottom: 8 }}>Delete Show?</h3>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 24, lineHeight: 1.6 }}>
        Are you sure you want to delete <strong style={{ color: "#E8E8F0" }}>{show.title}</strong>? This will permanently remove all seats and data.
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onClose} style={{ flex: 1, padding: "11px", borderRadius: 10, background: "transparent", border: "1px solid #23232F", color: "#888", cursor: "pointer", fontSize: 13, fontFamily: "DM Sans" }}>
          Cancel
        </button>
        <button onClick={onConfirm} disabled={loading} style={{ flex: 1, padding: "11px", borderRadius: 10, background: "#FF5555", border: "none", color: "#fff", fontWeight: 700, fontSize: 13, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, fontFamily: "DM Sans" }}>
          {loading ? "Deleting..." : "Yes, Delete"}
        </button>
      </div>
    </div>
  </div>
);

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const Dashboard = () => {
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [qrShow, setQrShow] = useState<Show | null>(null);
  const [viewShow, setViewShow] = useState<Show | null>(null);
  const [deleteShow, setDeleteShow] = useState<Show | null>(null);
  const navigate = useNavigate();

  const fetchShows = () => {
    setLoading(true);
    getMyShowsApi()
      .then((r) => setShows(r.data.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchShows(); }, []);

  const handleDelete = async () => {
    if (!deleteShow) return;
    setDeleting(true);
    try {
      await deleteShowApi(deleteShow.id);
      setShows(shows.filter((s) => s.id !== deleteShow.id));
      setDeleteShow(null);
    } catch (e: any) {
      alert(e.response?.data?.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "#555", fontSize: 14 }}>
      Loading shows...
    </div>
  );

  return (
    <div>
      {/* Modals */}
      {qrShow && <QRModal show={qrShow} onClose={() => setQrShow(null)} />}
      {viewShow && <ViewModal show={viewShow} onClose={() => setViewShow(null)} />}
      {deleteShow && <DeleteModal show={deleteShow} onConfirm={handleDelete} onClose={() => setDeleteShow(null)} loading={deleting} />}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 11, color: "#00D4A1", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Comedian Dashboard</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#E8E8F0", letterSpacing: "-0.02em" }}>My Shows</h1>
        </div>
        <button onClick={() => navigate("/client/show/create")} style={{ padding: "12px 24px", borderRadius: 10, background: "#00D4A1", border: "none", color: "#000", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "DM Sans" }}>
          + Create Show
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Total Shows", value: shows.length, color: "#E8E8F0" },
          { label: "Published", value: shows.filter(s => s.status === "PUBLISHED").length, color: "#00D4A1" },
          { label: "Draft", value: shows.filter(s => s.status === "DRAFT").length, color: "#FFB347" },
          { label: "Total Bookings", value: shows.reduce((s, sh) => s + sh._count.bookings, 0), color: "#6C63FF" },
        ].map((s) => (
          <div key={s.label} style={{ flex: 1, background: "#16161E", border: "1px solid #23232F", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color, fontFamily: "Space Mono" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Shows List */}
      {shows.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center", background: "#16161E", borderRadius: 14, border: "1px solid #23232F" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🎤</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#E8E8F0", marginBottom: 8 }}>No shows yet</div>
          <div style={{ fontSize: 14, color: "#555", marginBottom: 20 }}>Create your first show to get started</div>
          <button onClick={() => navigate("/client/show/create")} style={{ padding: "12px 24px", borderRadius: 10, background: "#00D4A1", border: "none", color: "#000", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "DM Sans" }}>
            + Create Show
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {shows.map((show) => {
            const occupancy = show._count.seats > 0
              ? Math.round((show._count.bookings / show._count.seats) * 100) : 0;
            return (
              <div key={show.id} style={{ background: "#16161E", border: "1px solid #23232F", borderRadius: 14, padding: 24, transition: "border-color 0.2s" }}>

                {/* Top Row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                      <h3 style={{ fontSize: 17, fontWeight: 700, color: "#E8E8F0" }}>{show.title}</h3>
                      <span style={{ padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700, background: `${STATUS_COLOR[show.status]}22`, color: STATUS_COLOR[show.status] }}>
                        {show.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "#555" }}>
                      {show.venue} · {show.city} · {fmt(show.date)} · {show.time}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: "flex", gap: 8, marginLeft: 16, flexShrink: 0 }}>
                    <button onClick={() => setViewShow(show)} style={{ padding: "8px 14px", borderRadius: 8, background: "#23232F", border: "1px solid #2A2A38", color: "#888", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "DM Sans" }}>
                      View
                    </button>
                    <button onClick={() => setQrShow(show)} style={{ padding: "8px 14px", borderRadius: 8, background: "#00D4A111", border: "1px solid #00D4A133", color: "#00D4A1", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "DM Sans" }}>
                      QR
                    </button>
                    <button onClick={() => navigate(`/client/show/${show.id}/edit`)} style={{ padding: "8px 14px", borderRadius: 8, background: "#6C63FF11", border: "1px solid #6C63FF33", color: "#6C63FF", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "DM Sans" }}>
                      Edit
                    </button>
                    <button onClick={() => setDeleteShow(show)} style={{ padding: "8px 14px", borderRadius: 8, background: "#FF555511", border: "1px solid #FF555533", color: "#FF5555", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "DM Sans" }}>
                      Delete
                    </button>
                  </div>
                </div>

                {/* Categories */}
                <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                  {show.seatCategories.map((cat: any) => (
                    <div key={cat.name} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: `${cat.color}11`, borderRadius: 6, border: `1px solid ${cat.color}33` }}>
                      <div style={{ width: 7, height: 7, borderRadius: 1, background: cat.color }} />
                      <span style={{ fontSize: 12, color: "#888" }}>{cat.name}</span>
                      <span style={{ fontSize: 12, color: cat.color, fontFamily: "Space Mono" }}>₹{cat.price.toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                {/* Occupancy */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: "#444" }}>Occupancy</span>
                    <span style={{ fontSize: 12, fontFamily: "Space Mono", color: "#555" }}>
                      {show._count.bookings}/{show._count.seats} seats · {occupancy}%
                    </span>
                  </div>
                  <div style={{ background: "#0F0F13", borderRadius: 100, height: 5, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${occupancy}%`, background: occupancy > 80 ? "#00D4A1" : occupancy > 50 ? "#FFB347" : "#6C63FF", borderRadius: 100, transition: "width 0.5s" }} />
                  </div>
                </div>

                {/* WhatsApp keyword strip */}
                <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#0F0F13", borderRadius: 8 }}>
                  <span style={{ fontSize: 11, color: "#444" }}>WhatsApp keyword:</span>
                  <span style={{ fontFamily: "Space Mono", fontSize: 12, color: "#00D4A1" }}>{show.whatsappKeyword}</span>
                  {show.qrCode && (
                    <span onClick={() => setQrShow(show)} style={{ marginLeft: "auto", fontSize: 11, color: "#00D4A1", cursor: "pointer", textDecoration: "underline" }}>
                      View QR →
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Dashboard;