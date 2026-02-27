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
  width: "100%", background: "#FFFFFF", border: "1px solid #E5E5E5",
  borderRadius: 10, color: "#000000", padding: "11px 14px",
  fontSize: 14, outline: "none", boxSizing: "border-box",
};

const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ fontSize: 13, color: "#AFAFAF", display: "block", marginBottom: 8 }}>{label}</label>
    {children}
    {error && <p style={{ color: "#000000", fontSize: 12, marginTop: 4 }}>{error}</p>}
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

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdShow, setCreatedShow] = useState<any>(null);
  const [posterImage, setPosterImage] = useState<string>("");
  const [posterPreview, setPosterPreview] = useState<string>("");

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

  const rowLabels = Array.from({ length: rows }, (_, i) => String.fromCharCode(65 + i));

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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setPosterImage(base64);
      setPosterPreview(base64);
    };
    reader.readAsDataURL(file);
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
        posterImage,
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
      setCreatedShow(res.data.data);
    } catch (e: any) {
      setError(e.response?.data?.message || "Failed to create show");
    } finally {
      setLoading(false);
    }
  };

  // ─── Success Screen ───────────────────────────────────────────────────────
  if (createdShow) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
        <div style={{ fontSize: 11, color: "#4A4A4A", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Show Created!</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#000000", marginBottom: 6 }}>{createdShow.title}</h2>
        <p style={{ fontSize: 13, color: "#AFAFAF", marginBottom: 20 }}>
          Your show has been created. Share the QR code for bookings.
        </p>

        {/* ✅ Show poster if uploaded */}
        {createdShow.posterImage && (
          <div style={{ marginBottom: 20, borderRadius: 12, overflow: "hidden", border: "1px solid #E5E5E5" }}>
            <img
              src={createdShow.posterImage}
              alt={createdShow.title}
              style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }}
            />
          </div>
        )}

        {createdShow.qrCode ? (
          <div style={{ background: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 16, padding: 28, marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: "#AFAFAF", marginBottom: 14 }}>
              Scan to view show info — <span style={{ color: "#4A4A4A" }}>{createdShow.title}</span>
            </div>
            <img
              src={createdShow.qrCode}
              alt="QR Code"
              style={{ width: 200, height: 200, borderRadius: 12, border: "4px solid #FFFFFF", marginBottom: 16, display: "block", margin: "0 auto 16px" }}
            />
            <div style={{ padding: "10px 14px", background: "#F9F9F9", borderRadius: 8, marginBottom: 16, border: "1px solid #E5E5E5" }}>
              <div style={{ fontSize: 11, color: "#AFAFAF", marginBottom: 4 }}>Show Keyword</div>
              <div style={{ fontFamily: "Space Mono", fontSize: 13, color: "#4A4A4A" }}>
                {createdShow.whatsappKeyword}
              </div>
            </div>
            <a
              href={createdShow.qrCode}
              download={`${createdShow.title}-QR.png`}
              style={{ display: "block", padding: "11px", borderRadius: 10, background: "#4A4A4A", color: "#FFFFFF", fontWeight: 700, fontSize: 13, textDecoration: "none" }}
            >
              ↓ Download QR Code
            </a>
          </div>
        ) : (
          <div style={{ padding: "20px", background: "#FFFFFF", borderRadius: 12, marginBottom: 20, color: "#AFAFAF", fontSize: 13, border: "1px solid #E5E5E5" }}>
            QR code is being generated. Check My Shows.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* ✅ FIX 1: was navigate("/client/show/create") — old route, caused login redirect */}
          <button
            onClick={() => { setCreatedShow(null); setStep(1); setPosterImage(""); setPosterPreview(""); }}
            style={{ width: "100%", padding: "12px", borderRadius: 10, background: "#F9F9F9", border: "1px solid #E5E5E5", color: "#4A4A4A", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "DM Sans" }}
          >
            + Create Another Show
          </button>
          {/* ✅ FIX 2: was navigate("/client/dashboard") — old route, caused login redirect */}
          <button
            onClick={() => navigate("/dashboard/shows")}
            style={{ width: "100%", padding: "12px", borderRadius: 10, background: "transparent", border: "1px solid #E5E5E5", color: "#AFAFAF", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "DM Sans" }}
          >
            Go to My Shows →
          </button>
        </div>
      </div>
    );
  }

  // ─── Main Wizard ──────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: "#4A4A4A", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Show Setup</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#000000", letterSpacing: "-0.02em" }}>Create New Show</h1>
      </div>

      {/* Step Indicator */}
      <div style={{ display: "flex", gap: 8, marginBottom: 32, alignItems: "center", flexWrap: "wrap" }}>
        {["Show Details", "Seat Layout", "Seat Map & Block"].map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 100, background: step === i + 1 ? "#4A4A4A" : step > i + 1 ? "#E5E5E5" : "transparent", border: `1px solid ${step === i + 1 ? "#4A4A4A" : step > i + 1 ? "#E5E5E5" : "#AFAFAF"}`, fontSize: 13, fontWeight: 500, color: step === i + 1 ? "#FFFFFF" : step > i + 1 ? "#4A4A4A" : "#AFAFAF" }}>
              <span>{step > i + 1 ? "✓" : i + 1}</span> {s}
            </div>
            {i < 2 && <div style={{ width: 20, height: 1, background: "#AFAFAF" }} />}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ background: "#00000011", border: "1px solid #00000033", borderRadius: 10, padding: "12px 16px", color: "#000000", fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* ─── STEP 1 ─── */}
      {step === 1 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
          <div style={{ background: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 14, padding: 28 }}>
            <div style={{ fontSize: 11, color: "#4A4A4A", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 20 }}>Basic Info</div>

            <Field label="Show Title *">
              <input style={inputStyle} value={showDetails.title} onChange={(e) => updateDetail("title", e.target.value)} placeholder="e.g. Comedy Night Vol.1" />
            </Field>
            <Field label="Description">
              <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={showDetails.description} onChange={(e) => updateDetail("description", e.target.value)} placeholder="About the show..." />
            </Field>

            {/* Poster Image Upload */}
            <Field label="Poster Image">
              <div
                style={{ border: "1px dashed #AFAFAF", borderRadius: 10, padding: 16, textAlign: "center", background: "#F9F9F9", cursor: "pointer", position: "relative" }}
                onClick={() => document.getElementById("poster-upload")?.click()}
              >
                {posterPreview ? (
                  <div style={{ position: "relative" }}>
                    <img src={posterPreview} alt="Poster" style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 8 }} />
                    <div
                      style={{ position: "absolute", top: 8, right: 8, background: "#00000088", borderRadius: 6, padding: "2px 8px", fontSize: 11, color: "#fff", cursor: "pointer" }}
                      onClick={(e) => { e.stopPropagation(); setPosterImage(""); setPosterPreview(""); }}
                    >
                      ✕ Remove
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🖼️</div>
                    <div style={{ fontSize: 13, color: "#AFAFAF" }}>Click to upload poster</div>
                    <div style={{ fontSize: 11, color: "#AFAFAF", marginTop: 4 }}>JPG, PNG — max 2MB</div>
                  </div>
                )}
                <input id="poster-upload" type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageUpload} />
              </div>
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
            </div>
            <Field label="Country *">
              <input style={inputStyle} value={showDetails.country} onChange={(e) => updateDetail("country", e.target.value)} placeholder="India" />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Date *">
                <input style={inputStyle} type="date" value={showDetails.date} onChange={(e) => updateDetail("date", e.target.value)} />
              </Field>
              <Field label="Time *">
                <input style={inputStyle} type="time" value={showDetails.time} onChange={(e) => updateDetail("time", e.target.value)} />
              </Field>
            </div>
          </div>

          <div style={{ background: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 14, padding: 28 }}>
            <div style={{ fontSize: 11, color: "#4A4A4A", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 20 }}>Cancellation Policy</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, padding: "14px 16px", background: "#F9F9F9", borderRadius: 10, border: "1px solid #E5E5E5" }}>
              <input type="checkbox" checked={showDetails.cancellationAllowed} onChange={(e) => updateDetail("cancellationAllowed", e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#000000" }}>Allow Cancellations</div>
                <div style={{ fontSize: 12, color: "#AFAFAF" }}>Users can cancel their bookings</div>
              </div>
            </div>
            {showDetails.cancellationAllowed && (
              <div>
                <div style={{ fontSize: 12, color: "#AFAFAF", marginBottom: 12 }}>Refund Slabs</div>
                {showDetails.refundSlabs.map((slab, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "center" }}>
                    <input style={{ ...inputStyle, flex: 1 }} type="number" value={slab.hoursBeforeShow} onChange={(e) => {
                      const updated = [...showDetails.refundSlabs];
                      updated[i] = { ...updated[i], hoursBeforeShow: parseInt(e.target.value) };
                      updateDetail("refundSlabs", updated);
                    }} placeholder="Hours before" />
                    <span style={{ color: "#AFAFAF", fontSize: 13 }}>hrs →</span>
                    <input style={{ ...inputStyle, flex: 1 }} type="number" value={slab.refundPercent} onChange={(e) => {
                      const updated = [...showDetails.refundSlabs];
                      updated[i] = { ...updated[i], refundPercent: parseInt(e.target.value) };
                      updateDetail("refundSlabs", updated);
                    }} placeholder="Refund %" />
                    <span style={{ color: "#AFAFAF", fontSize: 13 }}>%</span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => { if (validateStep1()) setStep(2); }} style={{ width: "100%", padding: "13px", borderRadius: 10, background: "#4A4A4A", border: "none", color: "#FFFFFF", fontWeight: 700, fontSize: 14, cursor: "pointer", marginTop: 24, fontFamily: "DM Sans" }}>
              Next: Configure Seats →
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 2 ─── */}
      {step === 2 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
          <div>
            <div style={{ background: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 14, padding: 24, marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "#4A4A4A", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Grid Config</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <Field label="Rows (A-Z)">
                  <input style={inputStyle} type="number" min={1} max={26} value={rows} onChange={(e) => setRows(Math.min(26, Math.max(1, +e.target.value)))} />
                </Field>
                <Field label="Seats per Row">
                  <input style={inputStyle} type="number" min={1} max={50} value={cols} onChange={(e) => setCols(Math.min(50, Math.max(1, +e.target.value)))} />
                </Field>
              </div>
              <div style={{ display: "flex", gap: 16, background: "#F9F9F9", borderRadius: 10, padding: "12px 16px", border: "1px solid #E5E5E5" }}>
                {[{ label: "Rows", value: rows }, { label: "Cols", value: cols }, { label: "Total", value: rows * cols }].map((s) => (
                  <div key={s.label} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#000000", fontFamily: "Space Mono" }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: "#AFAFAF" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 11, color: "#4A4A4A", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Arrangement Type</div>
              {ARRANGEMENT_TYPES.map((type) => (
                <div key={type.id} onClick={() => setArrangementType(type.id as ArrangementType)} style={{ padding: "12px 16px", borderRadius: 10, border: `1.5px solid ${arrangementType === type.id ? "#000000" : "#E5E5E5"}`, background: arrangementType === type.id ? "#E5E5E5" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, marginBottom: 8, transition: "all 0.2s" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: arrangementType === type.id ? "#000000" : "#F9F9F9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: arrangementType === type.id ? "#FFFFFF" : "#AFAFAF" }}>{type.icon}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: arrangementType === type.id ? "#000000" : "#AFAFAF" }}>{type.label}</div>
                    <div style={{ fontSize: 12, color: "#AFAFAF" }}>{type.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ background: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 14, padding: 24, marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "#4A4A4A", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Seat Categories</div>
              {categories.map((cat, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#F9F9F9", borderRadius: 10, marginBottom: 8, border: `1px solid ${cat.color}33` }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: cat.color, flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, fontSize: 13, color: "#000000", flex: 1 }}>{cat.name}</span>
                  <span style={{ fontSize: 12, color: "#000000", fontFamily: "Space Mono" }}>₹{cat.price}</span>
                  <span style={{ fontSize: 11, color: "#AFAFAF" }}>Row {cat.fromRow}–{cat.toRow}</span>
                  {categories.length > 1 && (
                    <button onClick={() => removeCategory(i)} style={{ background: "none", border: "none", color: "#AFAFAF", cursor: "pointer", fontSize: 14, fontFamily: "DM Sans" }}>✕</button>
                  )}
                </div>
              ))}
            </div>
            <div style={{ background: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 11, color: "#4A4A4A", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Add Category</div>
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
                <div style={{ fontSize: 13, color: "#AFAFAF", marginBottom: 8 }}>Color</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {COLOR_PRESETS.map((c) => (
                    <div key={c} onClick={() => setNewCat({ ...newCat, color: c })} style={{ width: 26, height: 26, borderRadius: 6, background: c, cursor: "pointer", border: newCat.color === c ? "2px solid #000000" : "2px solid transparent" }} />
                  ))}
                </div>
              </div>
              <button onClick={addCategory} style={{ width: "100%", padding: "10px", borderRadius: 10, background: newCat.name ? "#F9F9F9" : "#E5E5E5", border: `1px solid ${newCat.name ? "#E5E5E5" : "#AFAFAF"}`, color: newCat.name ? "#4A4A4A" : "#AFAFAF", fontWeight: 600, fontSize: 13, cursor: newCat.name ? "pointer" : "not-allowed", fontFamily: "DM Sans" }}>
                + Add Category
              </button>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: "12px", borderRadius: 10, background: "transparent", border: "1px solid #E5E5E5", color: "#AFAFAF", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "DM Sans" }}>
                ← Back
              </button>
              <button onClick={handleGenerateSeats} style={{ flex: 2, padding: "12px", borderRadius: 10, background: "#4A4A4A", border: "none", color: "#FFFFFF", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "DM Sans" }}>
                Generate Seat Map →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── STEP 3 ─── */}
      {step === 3 && (
        <div>
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            {categories.map((cat) => {
              const catSeats = seats.filter((s) => s.category === cat.name);
              const blocked = catSeats.filter((s) => blockedSeats.has(s.id)).length;
              return (
                <div key={cat.name} style={{ flex: 1, background: "#FFFFFF", border: `1px solid ${cat.color}44`, borderRadius: 10, padding: "12px 16px", minWidth: 160 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: cat.color }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#000000" }}>{cat.name}</span>
                    <span style={{ marginLeft: "auto", fontSize: 12, color: cat.color }}>₹{cat.price}</span>
                  </div>
                  <div style={{ fontFamily: "Space Mono", fontSize: 18, fontWeight: 700, color: "#000000" }}>{catSeats.length - blocked}</div>
                  <div style={{ fontSize: 11, color: "#AFAFAF" }}>available{blocked > 0 ? ` · ${blocked} blocked` : ""}</div>
                </div>
              );
            })}
            <div style={{ flex: 1, background: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 10, padding: "12px 16px", minWidth: 160 }}>
              <div style={{ fontSize: 12, color: "#AFAFAF", marginBottom: 6 }}>Total Blocked</div>
              <div style={{ fontFamily: "Space Mono", fontSize: 18, fontWeight: 700, color: "#000000" }}>{blockedSeats.size}</div>
              <div style={{ fontSize: 11, color: "#AFAFAF" }}>click to toggle</div>
            </div>
          </div>

          <div style={{ background: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div style={{ fontSize: 13, color: "#AFAFAF" }}>Click any seat to block/unblock it</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {categories.map((cat) => (
                  <div key={cat.name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: cat.color }} />
                    <span style={{ fontSize: 12, color: "#AFAFAF" }}>{cat.name}</span>
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: "#E5E5E5", border: "1px dashed #AFAFAF" }} />
                  <span style={{ fontSize: 12, color: "#AFAFAF" }}>Blocked</span>
                </div>
              </div>
            </div>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ display: "inline-block", padding: "6px 50px", background: "#E5E5E5", borderRadius: 6, fontSize: 11, color: "#AFAFAF", letterSpacing: 3 }}>STAGE / FRONT</div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, width: "fit-content", margin: "0 auto" }}>
                {rowLabels.map((row) => {
                  const rowSeats = seats.filter((s) => s.row === row);
                  return (
                    <div key={row} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <span style={{ width: 20, fontFamily: "Space Mono", fontSize: 11, color: "#AFAFAF", textAlign: "right", flexShrink: 0 }}>{row}</span>
                      <div style={{ width: 8 }} />
                      {rowSeats.map((seat) => {
                        const cat = categories.find((c) => c.name === seat.category);
                        const isBlocked = blockedSeats.has(seat.id);
                        const seatSize = cols > 30 ? 18 : cols > 20 ? 22 : 26;
                        return (
                          <div key={seat.id} onClick={() => toggleBlock(seat.id)} title={`${seat.id} · ${seat.category} · ₹${cat?.price || 0}`}
                            style={{ width: seatSize, height: seatSize, borderRadius: 4, background: isBlocked ? "#E5E5E5" : cat?.color || "#AFAFAF", opacity: isBlocked ? 0.6 : 1, border: isBlocked ? "1px dashed #AFAFAF" : "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#000000", fontFamily: "Space Mono", transition: "all 0.15s" }}
                          >
                            {seatSize > 20 && seat.col}
                          </div>
                        );
                      })}
                      <div style={{ width: 8 }} />
                      <span style={{ width: 20, fontFamily: "Space Mono", fontSize: 11, color: "#AFAFAF", flexShrink: 0 }}>{row}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <div style={{ display: "inline-block", padding: "6px 50px", background: "#E5E5E5", borderRadius: 6, fontSize: 11, color: "#AFAFAF", letterSpacing: 3 }}>BACK</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button onClick={() => setStep(2)} style={{ flex: 1, padding: "12px", borderRadius: 10, background: "transparent", border: "1px solid #E5E5E5", color: "#AFAFAF", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "DM Sans" }}>
              ← Edit Layout
            </button>
            <button onClick={handleSubmit} disabled={loading} style={{ flex: 2, padding: "12px", borderRadius: 10, background: loading ? "#E5E5E5" : "#4A4A4A", border: "none", color: loading ? "#AFAFAF" : "#FFFFFF", fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", fontFamily: "DM Sans" }}>
              {loading ? "Creating Show..." : "✓ Create Show"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateShow;