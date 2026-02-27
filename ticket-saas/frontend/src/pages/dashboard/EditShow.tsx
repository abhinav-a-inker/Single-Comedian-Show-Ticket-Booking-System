import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getShowByIdApi, updateShowApi } from "../../services/show.api";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#FFFFFF",
  border: "1px solid #E5E5E5",
  borderRadius: 10,
  color: "#000000",
  padding: "11px 14px",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 20 }}>
    <label style={{ fontSize: 13, color: "#AFAFAF", display: "block", marginBottom: 8, fontWeight: 500 }}>
      {label}
    </label>
    {children}
  </div>
);

const EditShow = () => {
  const { showId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [notFound, setNotFound] = useState(false);

  const [posterImage, setPosterImage] = useState<string>("");
  const [posterPreview, setPosterPreview] = useState<string>("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    venue: "",
    city: "",
    state: "",
    country: "",
    date: "",
    time: "",
    cancellationAllowed: true,
    refundSlabs: [
      { hoursBeforeShow: 48, refundPercent: 100 },
      { hoursBeforeShow: 24, refundPercent: 50 },
      { hoursBeforeShow: 0, refundPercent: 0 },
    ],
  });

  useEffect(() => {
    if (!showId) return;
    getShowByIdApi(showId)
      .then((r) => {
        const s = r.data?.data;
        if (!s) {
          setNotFound(true);
          return;
        }
        setForm({
          title: s.title || "",
          description: s.description || "",
          venue: s.venue || "",
          city: s.city || "",
          state: s.state || "",
          country: s.country || "",
          date: s.date ? s.date.slice(0, 10) : "",
          time: s.time || "",
          cancellationAllowed: s.cancellationAllowed ?? true,
          refundSlabs: Array.isArray(s.refundSlabs) && s.refundSlabs.length
            ? s.refundSlabs
            : [
                { hoursBeforeShow: 48, refundPercent: 100 },
                { hoursBeforeShow: 24, refundPercent: 50 },
                { hoursBeforeShow: 0, refundPercent: 0 },
              ],
        });
        if (s.posterImage) {
          setPosterImage(s.posterImage);
          setPosterPreview(s.posterImage);
        }
      })
      .catch((e) => {
        setError(e.response?.data?.message || "Failed to load show");
        setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [showId]);

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

  const update = (key: string, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await updateShowApi(showId!, { ...form, posterImage });
      setSuccess("Show updated successfully!");
      setTimeout(() => navigate("/dashboard/shows"), 1500);
    } catch (e: any) {
      setError(e.response?.data?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={{ color: "#AFAFAF", padding: "60px 20px", textAlign: "center", fontSize: 16 }}>
      Loading show details...
    </div>
  );

  if (notFound) return (
    <div style={{ padding: "60px 20px", textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: "#000000", marginBottom: 8 }}>Show not found</div>
      <div style={{ fontSize: 14, color: "#AFAFAF", marginBottom: 24 }}>
        {error || "This show doesn't exist or you don't have access."}
      </div>
      <button
        onClick={() => navigate("/dashboard/shows")}
        style={{
          padding: "12px 32px",
          borderRadius: 10,
          background: "#4A4A4A",
          border: "none",
          color: "#FFFFFF",
          fontWeight: 600,
          fontSize: 15,
          cursor: "pointer",
        }}
      >
        ← Back to Shows
      </button>
    </div>
  );

  return (
    <div style={{ padding: "16px 20px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 13, color: "#4A4A4A", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>
          Show Management
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#000000", letterSpacing: "-0.02em" }}>
          Edit Show
        </h1>
      </div>

      {error && (
        <div style={{ background: "#00000011", border: "1px solid #00000033", borderRadius: 10, padding: "14px 18px", color: "#000000", fontSize: 14, marginBottom: 24 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ background: "#4A4A4A11", border: "1px solid #4A4A4A33", borderRadius: 10, padding: "14px 18px", color: "#4A4A4A", fontSize: 14, marginBottom: 24 }}>
          {success}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24, '@media (min-width: 1024px)': { gridTemplateColumns: "1fr 1fr" } }}>
        {/* Left — Basic Info */}
        <div style={{ background: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 14, padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 13, color: "#4A4A4A", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 20, fontWeight: 600 }}>
            Basic Information
          </div>

          <Field label="Show Title">
            <input style={inputStyle} value={form.title} onChange={(e) => update("title", e.target.value)} />
          </Field>

          <Field label="Description">
            <textarea
              style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </Field>

          {/* Poster Image */}
          <Field label="Poster Image">
            <div
              style={{
                border: "1px dashed #AFAFAF",
                borderRadius: 10,
                padding: 20,
                textAlign: "center",
                background: "#F9F9F9",
                cursor: "pointer",
                position: "relative",
              }}
              onClick={() => document.getElementById("poster-upload-edit")?.click()}
            >
              {posterPreview ? (
                <div style={{ position: "relative" }}>
                  <img
                    src={posterPreview}
                    alt="Poster"
                    style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 8 }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      background: "#00000088",
                      borderRadius: 6,
                      padding: "4px 10px",
                      fontSize: 12,
                      color: "#fff",
                      cursor: "pointer",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPosterImage("");
                      setPosterPreview("");
                    }}
                  >
                    ✕ Remove
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 36, marginBottom: 12, color: "#AFAFAF" }}>🖼️</div>
                  <div style={{ fontSize: 14, color: "#AFAFAF", marginBottom: 4 }}>Click to upload or replace poster</div>
                  <div style={{ fontSize: 12, color: "#AFAFAF" }}>JPG, PNG — max 2MB</div>
                </div>
              )}
              <input
                id="poster-upload-edit"
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleImageUpload}
              />
            </div>
          </Field>

          <Field label="Venue">
            <input style={inputStyle} value={form.venue} onChange={(e) => update("venue", e.target.value)} />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, '@media (min-width: 640px)': { gridTemplateColumns: "1fr 1fr" } }}>
            <Field label="City">
              <input style={inputStyle} value={form.city} onChange={(e) => update("city", e.target.value)} />
            </Field>
            <Field label="State">
              <input style={inputStyle} value={form.state} onChange={(e) => update("state", e.target.value)} />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, '@media (min-width: 640px)': { gridTemplateColumns: "1fr 1fr" } }}>
            <Field label="Country">
              <input style={inputStyle} value={form.country} onChange={(e) => update("country", e.target.value)} />
            </Field>
            <Field label="Date">
              <input style={inputStyle} type="date" value={form.date} onChange={(e) => update("date", e.target.value)} />
            </Field>
          </div>

          <Field label="Time">
            <input style={inputStyle} type="time" value={form.time} onChange={(e) => update("time", e.target.value)} />
          </Field>
        </div>

        {/* Right — Cancellation Policy */}
        <div style={{ background: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 14, padding: "24px", display: "flex", flexDirection: "column", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 13, color: "#4A4A4A", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 20, fontWeight: 600 }}>
            Cancellation Policy
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, padding: "16px", background: "#F9F9F9", borderRadius: 10, border: "1px solid #E5E5E5" }}>
            <input
              type="checkbox"
              checked={form.cancellationAllowed}
              onChange={(e) => update("cancellationAllowed", e.target.checked)}
              style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#4A4A4A" }}
            />
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#000000" }}>Allow Cancellations</div>
              <div style={{ fontSize: 13, color: "#AFAFAF", marginTop: 2 }}>Users can cancel their bookings</div>
            </div>
          </div>

          {form.cancellationAllowed && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: "#AFAFAF", marginBottom: 12, fontWeight: 500 }}>Refund Slabs</div>
              {form.refundSlabs.map((slab: any, i: number) => (
                <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <input
                      style={{ ...inputStyle }}
                      type="number"
                      value={slab.hoursBeforeShow}
                      onChange={(e) => {
                        const updated = [...form.refundSlabs];
                        updated[i] = { ...updated[i], hoursBeforeShow: parseInt(e.target.value) };
                        update("refundSlabs", updated);
                      }}
                      placeholder="Hours before"
                    />
                  </div>
                  <span style={{ color: "#AFAFAF", fontSize: 14, whiteSpace: "nowrap" }}>hrs before →</span>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <input
                      style={{ ...inputStyle }}
                      type="number"
                      value={slab.refundPercent}
                      onChange={(e) => {
                        const updated = [...form.refundSlabs];
                        updated[i] = { ...updated[i], refundPercent: parseInt(e.target.value) };
                        update("refundSlabs", updated);
                      }}
                      placeholder="Refund %"
                    />
                  </div>
                  <span style={{ color: "#AFAFAF", fontSize: 14, whiteSpace: "nowrap" }}>%</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: "auto", paddingTop: 20 }}>
            <div style={{ display: "flex", gap: 12, flexDirection: "column", '@media (min-width: 640px)': { flexDirection: "row" } }}>
              <button
                onClick={() => navigate("/dashboard/shows")}
                style={{
                  flex: 1,
                  padding: "13px",
                  borderRadius: 10,
                  background: "transparent",
                  border: "1px solid #E5E5E5",
                  color: "#4A4A4A",
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  flex: 2,
                  padding: "13px",
                  borderRadius: 10,
                  background: saving ? "#E5E5E5" : "#4A4A4A",
                  border: "none",
                  color: saving ? "#AFAFAF" : "#FFFFFF",
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Saving..." : "✓ Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditShow;