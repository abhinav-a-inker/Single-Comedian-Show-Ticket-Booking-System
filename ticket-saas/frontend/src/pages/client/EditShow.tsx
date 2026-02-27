import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getShowByIdApi, updateShowApi } from "../../services/show.api";

const inputStyle: React.CSSProperties = {
  width: "100%", background: "#0F0F13", border: "1px solid #2A2A38",
  borderRadius: 10, color: "#E8E8F0", padding: "11px 14px",
  fontSize: 14, outline: "none", boxSizing: "border-box",
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ fontSize: 13, color: "#888", display: "block", marginBottom: 8 }}>{label}</label>
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

  const [form, setForm] = useState({
    title: "", description: "", venue: "", city: "",
    state: "", country: "", date: "", time: "",
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
        const s = r.data.data;
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
          refundSlabs: s.refundSlabs?.length
            ? s.refundSlabs
            : [
                { hoursBeforeShow: 48, refundPercent: 100 },
                { hoursBeforeShow: 24, refundPercent: 50 },
                { hoursBeforeShow: 0, refundPercent: 0 },
              ],
        });
      })
      .finally(() => setLoading(false));
  }, [showId]);

  const update = (key: string, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await updateShowApi(showId!, form);
      setSuccess("Show updated successfully!");
      setTimeout(() => navigate("/client/dashboard"), 1500);
    } catch (e: any) {
      setError(e.response?.data?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={{ color: "#555", padding: 40, textAlign: "center" }}>Loading show details...</div>
  );

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: "#00D4A1", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Show Management</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#E8E8F0", letterSpacing: "-0.02em" }}>Edit Show</h1>
      </div>

      {error && (
        <div style={{ background: "#FF555511", border: "1px solid #FF555533", borderRadius: 10, padding: "12px 16px", color: "#FF5555", fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ background: "#00D4A111", border: "1px solid #00D4A133", borderRadius: 10, padding: "12px 16px", color: "#00D4A1", fontSize: 13, marginBottom: 20 }}>
          {success}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Left */}
        <div style={{ background: "#16161E", border: "1px solid #23232F", borderRadius: 14, padding: 28 }}>
          <div style={{ fontSize: 11, color: "#00D4A1", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 20 }}>Basic Info</div>

          <Field label="Show Title">
            <input style={inputStyle} value={form.title} onChange={(e) => update("title", e.target.value)} />
          </Field>
          <Field label="Description">
            <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={form.description} onChange={(e) => update("description", e.target.value)} />
          </Field>
          <Field label="Venue">
            <input style={inputStyle} value={form.venue} onChange={(e) => update("venue", e.target.value)} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="City">
              <input style={inputStyle} value={form.city} onChange={(e) => update("city", e.target.value)} />
            </Field>
            <Field label="State">
              <input style={inputStyle} value={form.state} onChange={(e) => update("state", e.target.value)} />
            </Field>
            <Field label="Country">
              <input style={inputStyle} value={form.country} onChange={(e) => update("country", e.target.value)} />
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Date">
              <input style={inputStyle} type="date" value={form.date} onChange={(e) => update("date", e.target.value)} />
            </Field>
            <Field label="Time">
              <input style={inputStyle} type="time" value={form.time} onChange={(e) => update("time", e.target.value)} />
            </Field>
          </div>
        </div>

        {/* Right */}
        <div style={{ background: "#16161E", border: "1px solid #23232F", borderRadius: 14, padding: 28 }}>
          <div style={{ fontSize: 11, color: "#00D4A1", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 20 }}>Cancellation Policy</div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, padding: "14px 16px", background: "#0F0F13", borderRadius: 10 }}>
            <input type="checkbox" checked={form.cancellationAllowed} onChange={(e) => update("cancellationAllowed", e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#E8E8F0" }}>Allow Cancellations</div>
              <div style={{ fontSize: 12, color: "#555" }}>Users can cancel their bookings</div>
            </div>
          </div>

          {form.cancellationAllowed && (
            <div>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>Refund Slabs</div>
              {form.refundSlabs.map((slab: any, i: number) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "center" }}>
                  <input style={{ ...inputStyle, flex: 1 }} type="number" value={slab.hoursBeforeShow} onChange={(e) => {
                    const updated = [...form.refundSlabs];
                    updated[i] = { ...updated[i], hoursBeforeShow: parseInt(e.target.value) };
                    update("refundSlabs", updated);
                  }} placeholder="Hours before" />
                  <span style={{ color: "#555", fontSize: 13 }}>hrs →</span>
                  <input style={{ ...inputStyle, flex: 1 }} type="number" value={slab.refundPercent} onChange={(e) => {
                    const updated = [...form.refundSlabs];
                    updated[i] = { ...updated[i], refundPercent: parseInt(e.target.value) };
                    update("refundSlabs", updated);
                  }} placeholder="%" />
                  <span style={{ color: "#555", fontSize: 13 }}>%</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: "auto", paddingTop: 24 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => navigate("/client/dashboard")} style={{ flex: 1, padding: "12px", borderRadius: 10, background: "transparent", border: "1px solid #2A2A38", color: "#888", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "DM Sans" }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: "12px", borderRadius: 10, background: saving ? "#1A1A24" : "#00D4A1", border: "none", color: saving ? "#555" : "#000", fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", fontFamily: "DM Sans" }}>
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