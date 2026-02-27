import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createShowApi } from "../../services/show.api";

// ─── Types ────────────────────────────────────────────────────────────────────
type ArrangementType = "FRONT_TO_BACK" | "BACK_TO_FRONT" | "EQUAL";
type Category = { name: string; color: string; price: string; fromRow: string; toRow: string };

const ARRANGEMENT_TYPES = [
  { id: "FRONT_TO_BACK", label: "Front to Back", desc: "Premium seats at front (Row A)", icon: "▼" },
  { id: "BACK_TO_FRONT", label: "Back to Front", desc: "Premium seats at back (Last Row)", icon: "▲" },
  { id: "EQUAL", label: "Equal Priority", desc: "Manually assign categories to rows", icon: "═" },
];

const COLOR_PRESETS = ["#FFD700", "#FF8C00", "#708090", "#3B82F6", "#8B5CF6", "#EC4899", "#10B981", "#EF4444"];

const inputStyle: React.CSSProperties = {
  width: "100%", background: "#0F0F13", border: "1px solid #2A2A38",
  borderRadius: 10, color: "#E8E8F0", padding: "11px 14px",
  fontSize: 14, outline: "none", boxSizing: "border-box",
};

const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ fontSize: 13, color: "#888", display: "block", marginBottom: 8 }}>{label}</label>
    {children}
    {error && <p style={{ color: "#FF5555", fontSize: 12, marginTop: 4 }}>{error}</p>}
  </div>
);

function generateSeats(rows: number, cols: number, categories: Category[], arrangementType: ArrangementType) {
  const rowLabels = Array.from({ length: rows }, (_, i) => String.fromCharCode(65 + i));
  const seats: { id: string; row: string; col: number; category: string; isBlocked: boolean }[] = [];
  const rowsPerCat = Math.ceil(rows / Math.max(1, categories.length));

  rowLabels.forEach((row, rowIndex) => {
    let catIndex = 0;
    if (arrangementType === "FRONT_TO_BACK") catIndex = Math.min(Math.floor(rowIndex / rowsPerCat), categories.length - 1);
    else if (arrangementType === "BACK_TO_FRONT") catIndex = Math.min(Math.floor((rows - 1 - rowIndex) / rowsPerCat), categories.length - 1);
    else catIndex = rowIndex % categories.length;

    for (let col = 1; col <= cols; col++) {
      seats.push({ id: `${row}${col}`, row, col, category: categories[catIndex]?.name || "", isBlocked: false });
    }
  });
  return seats;
}

// ─── Main Component ───────────────────────────────────────────────────────────
const CreateShow = () => {
  const navigate = useNavigate();

  // ✅ FIX 1: ALL hooks at the very top inside the component
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdShow, setCreatedShow] = useState<any>(null); // ✅ was outside component before

  const [showDetails, setShowDetails] = useState({
    title: "", description: "", venue: "", city: "", state: "", country: "",
    date: "", time: "", cancellationAllowed: true,
    refundSlabs: [
      { hoursBeforeShow: 48, refundPercent: 100 },
      { hoursBeforeShow: 24, refundPercent: 50 },
      { hoursBeforeShow: 0, refundPercent: 0 },
    ],
  });

  const [rows, setRows] = useState(5);
  const [cols, setCols] = useState(10);
  const [arrangementType, setArrangementType] = useState<ArrangementType>("FRONT_TO_BACK");
  const [categories, setCategories] = useState<Category[]>([
    { name: "VIP", color: "#FFD700", price: "1500", fromRow: "A", toRow: "B" },
    { name: "General", color: "#3B82F6", price: "500", fromRow: "C", toRow: "E" },
  ]);
  const [newCat, setNewCat] = useState({ name: "", color: "#8B5CF6", price: "", fromRow: "", toRow: "" });
  const [seats, setSeats] = useState<ReturnType<typeof generateSeats>>([]);
  const [blockedSeats, setBlockedSeats] = useState<Set<string>>(new Set());

  // ─── Derived ───────────────────────────────────────────────────────────────
  const rowLabels = Array.from({ length: rows }, (_, i) => String.fromCharCode(65 + i));

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const updateDetail = (key: string, value: any) =>
    setShowDetails((prev) => ({ ...prev, [key]: value }));

  const addCategory = () => {
    if (!newCat.name || !newCat.fromRow || !newCat.toRow) return;
    setCategories([...categories, { ...newCat }]);
    setNewCat({ name: "", color: "#8B5CF6", price: "", fromRow: "", toRow: "" });
  };

  const removeCategory = (i: number) => {
    if (categories.length <= 1) return;
    setCategories(categories.filter((_, idx) => idx !== i));
  };

  const handleGenerateSeats = () => {
    const generated = generateSeats(rows, cols, categories, arrangementType);
    setSeats(generated);
    setBlockedSeats(new Set());
    setStep(3);
  };

  const toggleBlock = (seatId: string) => {
    setBlockedSeats((prev) => {
      const next = new Set(prev);
      next.has(seatId) ? next.delete(seatId) : next.add(seatId);
      return next;
    });
  };

  const validateStep1 = () => {
    const { title, venue, city, state, country, date, time } = showDetails;
    if (!title || !venue || !city || !state || !country || !date || !time) {
      setError("Please fill all required fields");
      return false;
    }
    setError("");
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = {
        ...showDetails,
        totalRows: rows,
        totalCols: cols,
        arrangementType,
        categories: categories.map((cat) => ({
          name: cat.name,
          color: cat.color,
          price: parseFloat(cat.price),
          fromRow: cat.fromRow,
          toRow: cat.toRow,
        })),
        blockedSeats: [...blockedSeats],
      };
      const res = await createShowApi(payload);
      setCreatedShow(res.data.data); // ✅ triggers success screen with QR
    } catch (e: any) {
      setError(e.response?.data?.message || "Failed to create show");
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIX 2: Early return AFTER all hooks and functions — never before
  if (createdShow) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
        <div style={{ fontSize: 11, color: "#00D4A1", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Show Created!</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#E8E8F0", marginBottom: 6 }}>{createdShow.title}</h2>
        <p style={{ fontSize: 13, color: "#555", marginBottom: 28 }}>
          Your show has been created. Share the QR code for bookings.
        </p>

        {createdShow.qrCode ? (
          <div style={{ background: "#16161E", border: "1px solid #23232F", borderRadius: 16, padding: 28, marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 14 }}>
              Scan to view show info — <span style={{ color: "#00D4A1" }}>{createdShow.title}</span>
            </div>
            <img
              src={createdShow.qrCode}
              alt="QR Code"
              style={{ width: 200, height: 200, borderRadius: 12, border: "4px solid #fff", marginBottom: 16, display: "block", margin: "0 auto 16px" }}
            />
            <div style={{ padding: "10px 14px", background: "#0F0F13", borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>Show Keyword</div>
              <div style={{ fontFamily: "Space Mono", fontSize: 13, color: "#00D4A1" }}>
                {createdShow.whatsappKeyword}
              </div>
            </div>
            <a
            
                href={createdShow.qrCode}
                download={`${createdShow.title}-QR.png`}
                style={{ display: "block", padding: "11px", borderRadius: 10, background: "#00D4A1", color: "#000", fontWeight: 700, fontSize: 13, textDecoration: "none" }}
              >
                ↓ Download QR Code
              </a>
          </div>
        ) : (
          <div style={{ padding: "20px", background: "#16161E", borderRadius: 12, marginBottom: 20, color: "#555", fontSize: 13 }}>
            QR code is being generated. Check My Shows.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={() => navigate("/client/show/create")}
            style={{ width: "100%", padding: "12px", borderRadius: 10, background: "#00D4A111", border: "1px solid #00D4A133", color: "#00D4A1", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "DM Sans" }}
          >
            + Create Another Show
          </button>
          <button
            onClick={() => navigate("/client/dashboard")}
            style={{ width: "100%", padding: "12px", borderRadius: 10, background: "transparent", border: "1px solid #23232F", color: "#888", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "DM Sans" }}
          >
            Go to My Shows →
          </button>
        </div>
      </div>
    );
  }

  // ✅ Main return — always at the very bottom
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: "#00D4A1", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Show Setup</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#E8E8F0", letterSpacing: "-0.02em" }}>Create New Show</h1>
      </div>

      {/* Step Indicator */}
      <div style={{ display: "flex", gap: 8, marginBottom: 32, alignItems: "center" }}>
        {["Show Details", "Seat Layout", "Seat Map & Block"].map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 100, background: step === i + 1 ? "#00D4A1" : step > i + 1 ? "#00D4A122" : "transparent", border: `1px solid ${step === i + 1 ? "#00D4A1" : step > i + 1 ? "#00D4A133" : "#2A2A38"}`, fontSize: 13, fontWeight: 500, color: step === i + 1 ? "#000" : step > i + 1 ? "#00D4A1" : "#555" }}>
              <span>{step > i + 1 ? "✓" : i + 1}</span> {s}
            </div>
            {i < 2 && <div style={{ width: 20, height: 1, background: "#2A2A38" }} />}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ background: "#FF555511", border: "1px solid #FF555533", borderRadius: 10, padding: "12px 16px", color: "#FF5555", fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* ─── STEP 1: Show Details ─── */}
      {step === 1 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div style={{ background: "#16161E", border: "1px solid #23232F", borderRadius: 14, padding: 28 }}>
            <div style={{ fontSize: 11, color: "#00D4A1", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 20 }}>Basic Info</div>

            <Field label="Show Title *">
              <input style={inputStyle} value={showDetails.title} onChange={(e) => updateDetail("title", e.target.value)} placeholder="e.g. Comedy Night Vol.1" />
            </Field>
            <Field label="Description">
              <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={showDetails.description} onChange={(e) => updateDetail("description", e.target.value)} placeholder="About the show..." />
            </Field>
            <Field label="Venue *">
              <input style={inputStyle} value={showDetails.venue} onChange={(e) => updateDetail("venue", e.target.value)} placeholder="e.g. The Comedy Club" />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="City *">
                <input style={inputStyle} value={showDetails.city} onChange={(e) => updateDetail("city", e.target.value)} placeholder="Mumbai" />
              </Field>
              <Field label="State *">
                <input style={inputStyle} value={showDetails.state} onChange={(e) => updateDetail("state", e.target.value)} placeholder="Maharashtra" />
              </Field>
              <Field label="Country *">
                <input style={inputStyle} value={showDetails.country} onChange={(e) => updateDetail("country", e.target.value)} placeholder="India" />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Date *">
                <input style={inputStyle} type="date" value={showDetails.date} onChange={(e) => updateDetail("date", e.target.value)} />
              </Field>
              <Field label="Time *">
                <input style={inputStyle} type="time" value={showDetails.time} onChange={(e) => updateDetail("time", e.target.value)} />
              </Field>
            </div>
          </div>

          <div style={{ background: "#16161E", border: "1px solid #23232F", borderRadius: 14, padding: 28 }}>
            <div style={{ fontSize: 11, color: "#00D4A1", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 20 }}>Cancellation Policy</div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, padding: "14px 16px", background: "#0F0F13", borderRadius: 10 }}>
              <input type="checkbox" checked={showDetails.cancellationAllowed} onChange={(e) => updateDetail("cancellationAllowed", e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#E8E8F0" }}>Allow Cancellations</div>
                <div style={{ fontSize: 12, color: "#555" }}>Users can cancel their bookings</div>
              </div>
            </div>

            {showDetails.cancellationAllowed && (
              <div>
                <div style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>Refund Slabs</div>
                {showDetails.refundSlabs.map((slab, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "center" }}>
                    <input style={{ ...inputStyle, flex: 1 }} type="number" value={slab.hoursBeforeShow} onChange={(e) => {
                      const updated = [...showDetails.refundSlabs];
                      updated[i] = { ...updated[i], hoursBeforeShow: parseInt(e.target.value) };
                      updateDetail("refundSlabs", updated);
                    }} placeholder="Hours before" />
                    <span style={{ color: "#555", fontSize: 13 }}>hrs →</span>
                    <input style={{ ...inputStyle, flex: 1 }} type="number" value={slab.refundPercent} onChange={(e) => {
                      const updated = [...showDetails.refundSlabs];
                      updated[i] = { ...updated[i], refundPercent: parseInt(e.target.value) };
                      updateDetail("refundSlabs", updated);
                    }} placeholder="Refund %" />
                    <span style={{ color: "#555", fontSize: 13 }}>%</span>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => { if (validateStep1()) setStep(2); }} style={{ width: "100%", padding: "13px", borderRadius: 10, background: "#00D4A1", border: "none", color: "#000", fontWeight: 700, fontSize: 14, cursor: "pointer", marginTop: 24, fontFamily: "DM Sans" }}>
              Next: Configure Seats →
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 2: Seat Layout ─── */}
      {step === 2 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <div style={{ background: "#16161E", border: "1px solid #23232F", borderRadius: 14, padding: 24, marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "#00D4A1", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Grid Config</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <Field label="Rows (A-Z)">
                  <input style={inputStyle} type="number" min={1} max={26} value={rows} onChange={(e) => setRows(Math.min(26, Math.max(1, +e.target.value)))} />
                </Field>
                <Field label="Seats per Row">
                  <input style={inputStyle} type="number" min={1} max={50} value={cols} onChange={(e) => setCols(Math.min(50, Math.max(1, +e.target.value)))} />
                </Field>
              </div>
              <div style={{ display: "flex", gap: 16, background: "#0F0F13", borderRadius: 10, padding: "12px 16px" }}>
                {[{ label: "Rows", value: rows }, { label: "Cols", value: cols }, { label: "Total", value: rows * cols }].map((s) => (
                  <div key={s.label} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#00D4A1", fontFamily: "Space Mono" }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: "#555" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "#16161E", border: "1px solid #23232F", borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 11, color: "#00D4A1", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Arrangement Type</div>
              {ARRANGEMENT_TYPES.map((type) => (
                <div key={type.id} onClick={() => setArrangementType(type.id as ArrangementType)} style={{ padding: "12px 16px", borderRadius: 10, border: `1.5px solid ${arrangementType === type.id ? "#00D4A1" : "#23232F"}`, background: arrangementType === type.id ? "#00D4A111" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, marginBottom: 8, transition: "all 0.2s" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: arrangementType === type.id ? "#00D4A1" : "#1A1A24", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: arrangementType === type.id ? "#000" : "#555" }}>{type.icon}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: arrangementType === type.id ? "#E8E8F0" : "#888" }}>{type.label}</div>
                    <div style={{ fontSize: 12, color: "#555" }}>{type.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ background: "#16161E", border: "1px solid #23232F", borderRadius: 14, padding: 24, marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "#00D4A1", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Seat Categories</div>
              {categories.map((cat, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#0F0F13", borderRadius: 10, marginBottom: 8, border: `1px solid ${cat.color}33` }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: cat.color, flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, fontSize: 13, color: "#E8E8F0", flex: 1 }}>{cat.name}</span>
                  <span style={{ fontSize: 12, color: "#00D4A1", fontFamily: "Space Mono" }}>₹{cat.price}</span>
                  <span style={{ fontSize: 11, color: "#555" }}>Row {cat.fromRow}–{cat.toRow}</span>
                  {categories.length > 1 && (
                    <button onClick={() => removeCategory(i)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 14, fontFamily: "DM Sans" }}>✕</button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ background: "#16161E", border: "1px solid #23232F", borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 11, color: "#00D4A1", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Add Category</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Name">
                  <input style={inputStyle} value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} placeholder="VIP, Gold..." />
                </Field>
                <Field label="Price (₹)">
                  <input style={inputStyle} type="number" value={newCat.price} onChange={(e) => setNewCat({ ...newCat, price: e.target.value })} placeholder="1000" />
                </Field>
                <Field label="From Row">
                  <input style={inputStyle} value={newCat.fromRow} onChange={(e) => setNewCat({ ...newCat, fromRow: e.target.value.toUpperCase() })} placeholder="A" maxLength={1} />
                </Field>
                <Field label="To Row">
                  <input style={inputStyle} value={newCat.toRow} onChange={(e) => setNewCat({ ...newCat, toRow: e.target.value.toUpperCase() })} placeholder="C" maxLength={1} />
                </Field>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: "#888", marginBottom: 8 }}>Color</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {COLOR_PRESETS.map((c) => (
                    <div key={c} onClick={() => setNewCat({ ...newCat, color: c })} style={{ width: 26, height: 26, borderRadius: 6, background: c, cursor: "pointer", border: newCat.color === c ? "2px solid #fff" : "2px solid transparent" }} />
                  ))}
                </div>
              </div>
              <button onClick={addCategory} style={{ width: "100%", padding: "10px", borderRadius: 10, background: newCat.name ? "#00D4A122" : "#1A1A24", border: `1px solid ${newCat.name ? "#00D4A133" : "#23232F"}`, color: newCat.name ? "#00D4A1" : "#555", fontWeight: 600, fontSize: 13, cursor: newCat.name ? "pointer" : "not-allowed", fontFamily: "DM Sans" }}>
                + Add Category
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: "12px", borderRadius: 10, background: "transparent", border: "1px solid #2A2A38", color: "#888", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "DM Sans" }}>← Back</button>
              <button onClick={handleGenerateSeats} style={{ flex: 2, padding: "12px", borderRadius: 10, background: "#00D4A1", border: "none", color: "#000", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "DM Sans" }}>
                Generate Seat Map →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── STEP 3: Seat Map & Block ─── */}
      {step === 3 && (
        <div>
          {/* Category Stats */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            {categories.map((cat) => {
              const catSeats = seats.filter((s) => s.category === cat.name);
              const blocked = catSeats.filter((s) => blockedSeats.has(s.id)).length;
              return (
                <div key={cat.name} style={{ flex: 1, background: "#16161E", border: `1px solid ${cat.color}44`, borderRadius: 10, padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: cat.color }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#ccc" }}>{cat.name}</span>
                    <span style={{ marginLeft: "auto", fontSize: 12, color: cat.color }}>₹{cat.price}</span>
                  </div>
                  <div style={{ fontFamily: "Space Mono", fontSize: 18, fontWeight: 700, color: "#E8E8F0" }}>{catSeats.length - blocked}</div>
                  <div style={{ fontSize: 11, color: "#555" }}>available{blocked > 0 ? ` · ${blocked} blocked` : ""}</div>
                </div>
              );
            })}
            <div style={{ flex: 1, background: "#16161E", border: "1px solid #23232F", borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>Total Blocked</div>
              <div style={{ fontFamily: "Space Mono", fontSize: 18, fontWeight: 700, color: "#FF5555" }}>{blockedSeats.size}</div>
              <div style={{ fontSize: 11, color: "#555" }}>click to toggle</div>
            </div>
          </div>

          {/* Seat Map */}
          <div style={{ background: "#16161E", border: "1px solid #23232F", borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "#555" }}>Click any seat to block/unblock it</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {categories.map((cat) => (
                  <div key={cat.name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: cat.color }} />
                    <span style={{ fontSize: 12, color: "#777" }}>{cat.name}</span>
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: "#333", border: "1px dashed #555" }} />
                  <span style={{ fontSize: 12, color: "#777" }}>Blocked</span>
                </div>
              </div>
            </div>

            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ display: "inline-block", padding: "6px 50px", background: "#23232F", borderRadius: 6, fontSize: 11, color: "#555", letterSpacing: 3 }}>STAGE / FRONT</div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, width: "fit-content", margin: "0 auto" }}>
                {rowLabels.map((row) => {
                  const rowSeats = seats.filter((s) => s.row === row);
                  return (
                    <div key={row} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <span style={{ width: 20, fontFamily: "Space Mono", fontSize: 11, color: "#444", textAlign: "right", flexShrink: 0 }}>{row}</span>
                      <div style={{ width: 8 }} />
                      {rowSeats.map((seat) => {
                        const cat = categories.find((c) => c.name === seat.category);
                        const isBlocked = blockedSeats.has(seat.id);
                        const seatSize = cols > 30 ? 18 : cols > 20 ? 22 : 26;
                        return (
                          <div
                            key={seat.id}
                            onClick={() => toggleBlock(seat.id)}
                            title={`${seat.id} · ${seat.category} · ₹${cat?.price || 0}`}
                            style={{ width: seatSize, height: seatSize, borderRadius: 4, background: isBlocked ? "#1A1A24" : cat?.color || "#3A3A50", opacity: isBlocked ? 0.4 : 0.85, border: isBlocked ? "1px dashed #444" : "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#fff", fontFamily: "Space Mono", transition: "all 0.15s" }}
                          >
                            {seatSize > 20 && seat.col}
                          </div>
                        );
                      })}
                      <div style={{ width: 8 }} />
                      <span style={{ width: 20, fontFamily: "Space Mono", fontSize: 11, color: "#444", flexShrink: 0 }}>{row}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ textAlign: "center", marginTop: 16 }}>
              <div style={{ display: "inline-block", padding: "6px 50px", background: "#1A1A24", borderRadius: 6, fontSize: 11, color: "#444", letterSpacing: 3 }}>BACK</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button onClick={() => setStep(2)} style={{ padding: "12px 24px", borderRadius: 10, background: "transparent", border: "1px solid #2A2A38", color: "#888", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "DM Sans" }}>
              ← Edit Layout
            </button>
            <button onClick={handleSubmit} disabled={loading} style={{ flex: 1, padding: "12px", borderRadius: 10, background: loading ? "#1A1A24" : "#00D4A1", border: "none", color: loading ? "#555" : "#000", fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", fontFamily: "DM Sans" }}>
              {loading ? "Creating Show..." : "✓ Create Show"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateShow;