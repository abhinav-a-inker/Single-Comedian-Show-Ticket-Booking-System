import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyShowsApi, deleteShowApi, updateShowApi } from "../../services/show.api";
import { getRole } from "../../utils/token";
import type { Show } from "../../types/show.types";

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "#AFAFAF",           // Medium Gray
  BOOKING_ENABLED: "#4A4A4A", // Dark Gray (strong/positive)
  BOOKING_DISABLED: "#AFAFAF",
  CANCELLED: "#000000",       // Pure Black for alert/danger
  COMPLETED: "#4A4A4A",
};

const STATUS_BG: Record<string, string> = {
  DRAFT: "#E5E5E5",
  BOOKING_ENABLED: "#FFFFFF",
  BOOKING_DISABLED: "#E5E5E5",
  CANCELLED: "#E5E5E5",
  COMPLETED: "#FFFFFF",
};

// ─── QR Modal ────────────────────────────────────────────────────────────────
const QRModal = ({ show, onClose }: { show: Show; onClose: () => void }) => (
  <div
    onClick={onClose}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "16px",
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E5E5",
        borderRadius: 16,
        padding: "24px",
        maxWidth: 380,
        width: "100%",
        textAlign: "center",
        boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#4A4A4A",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 8,
          fontWeight: 600,
        }}
      >
        WhatsApp QR Code
      </div>
      <h3 style={{ fontSize: 20, fontWeight: 700, color: "#000000", marginBottom: 4 }}>
        {show.title}
      </h3>
      <p style={{ fontSize: 13, color: "#AFAFAF", marginBottom: 20 }}>
        Scan to view show information
      </p>

      {show.qrCode ? (
        <>
          <img
            src={show.qrCode}
            alt="QR Code"
            style={{
              width: 220,
              height: 220,
              borderRadius: 12,
              border: "2px solid #E5E5E5",
              margin: "0 auto 20px",
              display: "block",
            }}
          />
          <div
            style={{
              padding: "12px",
              background: "#F9F9F9",
              borderRadius: 10,
              marginBottom: 20,
              border: "1px solid #E5E5E5",
            }}
          >
            <div style={{ fontSize: 12, color: "#AFAFAF", marginBottom: 4 }}>Keyword</div>
            <div style={{ fontFamily: "monospace", fontSize: 15, color: "#4A4A4A", fontWeight: 600 }}>
              {show.whatsappKeyword}
            </div>
          </div>
          <a
            href={show.qrCode}
            download={`${show.title}-QR.png`}
            style={{
              display: "block",
              padding: "12px",
              borderRadius: 10,
              background: "#4A4A4A",
              color: "#FFFFFF",
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
              marginBottom: 12,
            }}
          >
            Download QR Code
          </a>
        </>
      ) : (
        <div style={{ color: "#AFAFAF", fontSize: 14, padding: "20px 0" }}>
          No QR code available
        </div>
      )}

      <button
        onClick={onClose}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: 10,
          background: "transparent",
          border: "1px solid #AFAFAF",
          color: "#4A4A4A",
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        Close
      </button>
    </div>
  </div>
);

// ─── View Modal ──────────────────────────────────────────────────────────────
const ViewModal = ({ show, onClose }: { show: Show; onClose: () => void }) => (
  <div
    onClick={onClose}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "16px",
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E5E5",
        borderRadius: 16,
        padding: "24px",
        maxWidth: 560,
        width: "100%",
        maxHeight: "90vh",
        overflowY: "auto",
        boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div
            style={{
              fontSize: 12,
              color: "#AFAFAF",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 6,
              fontWeight: 600,
            }}
          >
            Show Details
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#000000" }}>{show.title}</h2>
        </div>
        <span
          style={{
            padding: "6px 14px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            background: STATUS_BG[show.status],
            color: STATUS_COLOR[show.status],
            border: `1px solid ${STATUS_COLOR[show.status]}33`,
          }}
        >
          {show.status.replace(/_/g, " ")}
        </span>
      </div>

      {show.description && (
        <div
          style={{
            padding: "16px",
            background: "#F9F9F9",
            borderRadius: 12,
            marginBottom: 24,
            fontSize: 14,
            color: "#4A4A4A",
            lineHeight: 1.6,
            border: "1px solid #E5E5E5",
          }}
        >
          {show.description}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Venue", value: show.venue },
          { label: "City", value: show.city },
          { label: "State", value: show.state },
          { label: "Country", value: show.country },
          { label: "Date", value: fmt(show.date) },
          { label: "Time", value: show.time },
          { label: "Total Seats", value: String(show.totalSeats) },
          { label: "Arrangement", value: show.arrangementType },
          { label: "Cancellation", value: show.cancellationAllowed ? "Allowed" : "Not Allowed" },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              padding: "12px 16px",
              background: "#F9F9F9",
              borderRadius: 10,
              border: "1px solid #E5E5E5",
            }}
          >
            <div style={{ fontSize: 11, color: "#AFAFAF", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
              {item.label}
            </div>
            <div style={{ fontSize: 14, color: "#000000", fontWeight: 500 }}>{item.value || "—"}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: "#AFAFAF", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12, fontWeight: 600 }}>
          Seat Categories
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {show.seatCategories.map((cat: any) => (
            <div
              key={cat.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                background: "#F9F9F9",
                borderRadius: 10,
                border: `1px solid ${cat.color}44`,
              }}
            >
              <div style={{ width: 12, height: 12, borderRadius: 4, background: cat.color }} />
              <span style={{ fontWeight: 600, fontSize: 14, color: "#000000", flex: 1 }}>{cat.name}</span>
              <span style={{ fontSize: 13, color: "#AFAFAF" }}>Row {cat.fromRow}–{cat.toRow}</span>
              <span style={{ fontFamily: "monospace", fontSize: 14, color: "#4A4A4A", fontWeight: 600 }}>
                ₹{cat.price.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onClose}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: 10,
          background: "transparent",
          border: "1px solid #AFAFAF",
          color: "#4A4A4A",
          fontSize: 14,
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        Close
      </button>
    </div>
  </div>
);

// ─── Delete Modal ────────────────────────────────────────────────────────────
const DeleteModal = ({ show, onConfirm, onClose, loading }: { show: Show; onConfirm: () => void; onClose: () => void; loading: boolean }) => (
  <div
    onClick={onClose}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "16px",
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E5E5",
        borderRadius: 16,
        padding: "32px 24px",
        maxWidth: 400,
        width: "100%",
        textAlign: "center",
        boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
      }}
    >
      <div style={{ fontSize: 42, marginBottom: 16 }}>🗑️</div>
      <h3 style={{ fontSize: 20, fontWeight: 700, color: "#000000", marginBottom: 8 }}>Delete Show?</h3>
      <p style={{ fontSize: 14, color: "#4A4A4A", marginBottom: 24, lineHeight: 1.5 }}>
        This action will permanently delete <strong>{show.title}</strong> and all related data.
      </p>
      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={onClose}
          style={{
            flex: 1,
            padding: "12px",
            borderRadius: 10,
            background: "transparent",
            border: "1px solid #AFAFAF",
            color: "#4A4A4A",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          style={{
            flex: 1,
            padding: "12px",
            borderRadius: 10,
            background: "#000000",
            color: "#FFFFFF",
            fontWeight: 600,
            fontSize: 14,
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  </div>
);

// ─── Main Component ──────────────────────────────────────────────────────────
export default function Shows() {
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrShow, setQrShow] = useState<Show | null>(null);
  const [viewShow, setViewShow] = useState<Show | null>(null);
  const [deleteShow, setDeleteShow] = useState<Show | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  const navigate = useNavigate();
  const role = getRole();
  const isAdmin = role === "ADMIN";
  const isClient = role === "CLIENT";

  useEffect(() => {
    getMyShowsApi()
      .then((r) => setShows(r.data.data || []))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async () => {
    if (!deleteShow) return;
    setDeleting(true);
    try {
      await deleteShowApi(deleteShow.id);
      setShows(shows.filter((s) => s.id !== deleteShow.id));
      setDeleteShow(null);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to delete show");
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusChange = async (show: Show, newStatus: string) => {
    setStatusUpdating(show.id);
    try {
      const res = await updateShowApi(show.id, { status: newStatus });
      setShows(shows.map((s) => (s.id === show.id ? { ...s, status: res.data.data.status } : s)));
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to update status");
    } finally {
      setStatusUpdating(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#AFAFAF", fontSize: 16 }}>
        Loading shows...
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 20px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Modals */}
      {qrShow && <QRModal show={qrShow} onClose={() => setQrShow(null)} />}
      {viewShow && <ViewModal show={viewShow} onClose={() => setViewShow(null)} />}
      {deleteShow && (
        <DeleteModal
          show={deleteShow}
          onConfirm={handleDelete}
          onClose={() => setDeleteShow(null)}
          loading={deleting}
        />
      )}

      {/* Header */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          marginBottom: 32,
          "@media (min-width: 640px)": { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              color: "#AFAFAF",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            {isAdmin ? "All Shows" : "My Shows"}
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#000000", letterSpacing: "-0.02em" }}>
            Shows
          </h1>
        </div>

        {isClient && (
          <button
            onClick={() => navigate("/dashboard/create")}
            style={{
              padding: "12px 28px",
              borderRadius: 10,
              background: "#4A4A4A",
              color: "#FFFFFF",
              fontWeight: 600,
              fontSize: 15,
              border: "none",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            + Create New Show
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        {[
          { label: "Total", value: shows.length, color: "#000000" },
          { label: "Booking On", value: shows.filter((s) => s.status === "BOOKING_ENABLED").length, color: "#4A4A4A" },
          { label: "Booking Off", value: shows.filter((s) => s.status === "BOOKING_DISABLED").length, color: "#AFAFAF" },
          { label: "Draft", value: shows.filter((s) => s.status === "DRAFT").length, color: "#AFAFAF" },
          { label: "Cancelled", value: shows.filter((s) => s.status === "CANCELLED").length, color: "#000000" },
          { label: "Completed", value: shows.filter((s) => s.status === "COMPLETED").length, color: "#4A4A4A" },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              background: "#FFFFFF",
              border: "1px solid #E5E5E5",
              borderRadius: 12,
              padding: "16px 20px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ fontSize: 12, color: "#AFAFAF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
              {item.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: item.color, fontFamily: "monospace" }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Shows List */}
      {shows.length === 0 ? (
        <div
          style={{
            padding: "60px 20px",
            textAlign: "center",
            background: "#FFFFFF",
            borderRadius: 16,
            border: "1px solid #E5E5E5",
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎤</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#000000", marginBottom: 12 }}>No shows found</div>
          {isClient && (
            <button
              onClick={() => navigate("/dashboard/create")}
              style={{
                marginTop: 8,
                padding: "12px 32px",
                borderRadius: 10,
                background: "#4A4A4A",
                color: "#FFFFFF",
                fontWeight: 600,
                fontSize: 15,
                border: "none",
                cursor: "pointer",
              }}
            >
              Create Your First Show
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {shows.map((show) => {
            const occupancy =
              show._count?.seats > 0
                ? Math.round(((show._count?.bookings || 0) / show._count.seats) * 100)
                : 0;

            return (
              <div
                key={show.id}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E5E5E5",
                  borderRadius: 16,
                  padding: "20px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
                }}
              >
                {/* Header row */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    marginBottom: 16,
                    "@media (min-width: 640px)": { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
                      <h3 style={{ fontSize: 19, fontWeight: 700, color: "#000000", margin: 0 }}>{show.title}</h3>
                      <span
                        style={{
                          padding: "4px 12px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 600,
                          background: STATUS_BG[show.status],
                          color: STATUS_COLOR[show.status],
                          border: `1px solid ${STATUS_COLOR[show.status]}33`,
                        }}
                      >
                        {show.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, color: "#4A4A4A" }}>
                      {show.venue} • {show.city} • {fmt(show.date)} • {show.time}
                    </div>
                  </div>

                  {/* Actions */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 10,
                      marginTop: 12,
                      "@media (min-width: 640px)": { marginTop: 0, marginLeft: 16 },
                    }}
                  >
                    <button
                      onClick={() => setViewShow(show)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        background: "#F9F9F9",
                        border: "1px solid #E5E5E5",
                        color: "#4A4A4A",
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      View
                    </button>

                    <button
                      onClick={() => setQrShow(show)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        background: "#F9F9F9",
                        border: "1px solid #E5E5E5",
                        color: "#4A4A4A",
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      QR Code
                    </button>

                    {isClient && (
                      <>
                        <button
                          onClick={() => navigate(`/dashboard/show/${show.id}/edit`)}
                          style={{
                            padding: "8px 16px",
                            borderRadius: 8,
                            background: "#F9F9F9",
                            border: "1px solid #E5E5E5",
                            color: "#4A4A4A",
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>

                        <select
                          value={show.status}
                          disabled={statusUpdating === show.id}
                          onChange={(e) => handleStatusChange(show, e.target.value)}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 8,
                            background: "#F9F9F9",
                            border: "1px solid #E5E5E5",
                            color: "#4A4A4A",
                            fontSize: 13,
                            cursor: "pointer",
                            minWidth: 140,
                          }}
                        >
                          <option value="DRAFT">Draft</option>
                          <option value="BOOKING_ENABLED">Booking Enabled</option>
                          <option value="BOOKING_DISABLED">Booking Disabled</option>
                          <option value="CANCELLED">Cancelled</option>
                          <option value="COMPLETED">Completed</option>
                        </select>
                      </>
                    )}

                    <button
                      onClick={() => setDeleteShow(show)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        background: "#000000",
                        border: "none",
                        color: "#FFFFFF",
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Categories */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
                  {show.seatCategories.map((cat: any) => (
                    <div
                      key={cat.name}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 14px",
                        background: "#F9F9F9",
                        borderRadius: 8,
                        border: `1px solid ${cat.color}33`,
                      }}
                    >
                      <div style={{ width: 10, height: 10, borderRadius: 4, background: cat.color }} />
                      <span style={{ fontSize: 13, color: "#4A4A4A", fontWeight: 500 }}>{cat.name}</span>
                      <span style={{ fontSize: 13, color: "#AFAFAF" }}>₹{cat.price.toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                {/* Occupancy Bar */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: "#AFAFAF" }}>Occupancy</span>
                    <span style={{ fontSize: 13, color: "#4A4A4A", fontFamily: "monospace" }}>
                      {show._count?.bookings || 0} / {show._count?.seats || 0} · {occupancy}%
                    </span>
                  </div>
                  <div
                    style={{
                      background: "#E5E5E5",
                      borderRadius: 999,
                      height: 8,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${occupancy}%`,
                        background: occupancy > 80 ? "#4A4A4A" : occupancy > 50 ? "#AFAFAF" : "#AFAFAF",
                        borderRadius: 999,
                        transition: "width 0.6s ease",
                      }}
                    />
                  </div>
                </div>

                {/* WhatsApp Keyword */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 16px",
                    background: "#F9F9F9",
                    borderRadius: 10,
                    border: "1px solid #E5E5E5",
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: "#AFAFAF", fontWeight: 500 }}>WhatsApp Keyword:</span>
                  <span style={{ fontFamily: "monospace", color: "#4A4A4A", fontWeight: 600 }}>
                    {show.whatsappKeyword || "—"}
                  </span>
                  {show.qrCode && (
                    <button
                      onClick={() => setQrShow(show)}
                      style={{
                        marginLeft: "auto",
                        color: "#4A4A4A",
                        fontSize: 13,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      View QR →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}