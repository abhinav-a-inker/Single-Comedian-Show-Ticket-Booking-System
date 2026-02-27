import { useEffect, useState } from "react";
import { getClientProfileApi, updateClientStatusApi } from "../../services/admin.api";
import type { Client } from "../../types/admin.types";

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const Comedian = () => {
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getClientProfileApi()
      .then((r) => setClient(r.data.data))
      .catch((err) => setError(err.response?.data?.message || "Failed to load comedian"))
      .finally(() => setLoading(false));
  }, []);

  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      const res = await updateClientStatusApi(action);
      if (res.data.data) {
        setClient(res.data.data);
      }
      setMessage(res.data.message || "Action successful");
      setTimeout(() => setMessage(""), 3000);
    } catch (e: any) {
      setMessage(e.response?.data?.message || "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div style={{ color: "#555", padding: 40 }}>Loading...</div>;
  
  if (error || !client) {
    return (
      <div>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: "#6C63FF", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Management</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#E8E8F0", letterSpacing: "-0.02em" }}>Comedian Profile</h1>
        </div>
        <div style={{ background: "#16161E", border: "1px solid #23232F", borderRadius: 14, padding: 40, textAlign: "center", color: "#555" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎤</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#E8E8F0", marginBottom: 8 }}>No pending comedians</div>
          <div style={{ fontSize: 14, color: "#666" }}>There are no pending comedian accounts to review. {error && `(${error})`}</div>
        </div>
      </div>
    );
  }

  const statusLabel =
    client.status === "SUSPENDED" ? { label: "Suspended", color: "#FF5555" } :
    client.status === "APPROVED"  ? { label: "Active",    color: "#00D4A1" } :
    client.status === "REJECTED"  ? { label: "Rejected",  color: "#FF5555" } :
                                    { label: "Pending",   color: "#FFB347" };

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: "#6C63FF", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Management</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#E8E8F0", letterSpacing: "-0.02em" }}>Comedian Profile</h1>
      </div>

      {message && (
        <div style={{ background: "#00D4A111", border: "1px solid #00D4A133", borderRadius: 10, padding: "12px 18px", color: "#00D4A1", fontSize: 13, marginBottom: 20 }}>
          {message}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
        {/* Profile */}
        <div style={{ background: "#16161E", border: "1px solid #23232F", borderRadius: 14, padding: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 28, paddingBottom: 24, borderBottom: "1px solid #1A1A24" }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: "#6C63FF22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, border: "1px solid #6C63FF33" }}>🎤</div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#E8E8F0", marginBottom: 4 }}>{client.fullName}</h2>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>{client.companyName}</div>
              <span style={{ padding: "3px 12px", borderRadius: 100, fontSize: 11, fontWeight: 700, background: `${statusLabel.color}22`, color: statusLabel.color }}>
                {statusLabel.label}
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {[
              { label: "Login Email",   value: client.login.email },
              { label: "Phone",         value: client.phone },
              { label: "Contact Email", value: client.contactEmail },
              { label: "Location",      value: `${client.city}, ${client.state}` },
              { label: "Country",       value: client.country },
              { label: "Member Since",  value: fmt(client.login.createdAt) },
              { label: "Total Shows",   value: String(client._count.shows) },
            ].map((f) => (
              <div key={f.label}>
                <div style={{ fontSize: 11, color: "#444", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{f.label}</div>
                <div style={{ fontSize: 14, color: "#C0C0D0" }}>{f.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ background: "#16161E", border: "1px solid #23232F", borderRadius: 14, padding: 24, height: "fit-content" }}>
          <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Account Actions</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

              {client.status === "PENDING" && (
                <>
                  <button onClick={() => handleAction("APPROVE")} disabled={!!actionLoading} style={{ padding: "12px", borderRadius: 10, background: "#00D4A1", border: "none", color: "#000", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: actionLoading ? 0.6 : 1 }}>
                    {actionLoading === "APPROVE" ? "Approving..." : "✓ Approve Account"}
                  </button>
                  <button onClick={() => handleAction("REJECT")} disabled={!!actionLoading} style={{ padding: "12px", borderRadius: 10, background: "#FF555511", border: "1px solid #FF555533", color: "#FF5555", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: actionLoading ? 0.6 : 1 }}>
                    {actionLoading === "REJECT" ? "Rejecting..." : "✕ Reject Account"}
                  </button>
                </>
              )}

              {client.status === "APPROVED" && (
                <>
                  <button onClick={() => handleAction("SUSPEND")} disabled={!!actionLoading} style={{ padding: "12px", borderRadius: 10, background: "#FFB34711", border: "1px solid #FFB34733", color: "#FFB347", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: actionLoading ? 0.6 : 1 }}>
                    {actionLoading === "SUSPEND" ? "Suspending..." : "⏸ Suspend Account"}
                  </button>
                  <div style={{ padding: "10px 14px", background: "#00D4A111", borderRadius: 8, border: "1px solid #00D4A122", fontSize: 12, color: "#00D4A1" }}>
                    ✓ Account is active
                  </div>
                </>
              )}

              {client.status === "SUSPENDED" && (
                <button onClick={() => handleAction("ACTIVATE")} disabled={!!actionLoading} style={{ padding: "12px", borderRadius: 10, background: "#00D4A111", border: "1px solid #00D4A133", color: "#00D4A1", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: actionLoading ? 0.6 : 1 }}>
                  {actionLoading === "ACTIVATE" ? "Activating..." : "▶ Activate Account"}
                </button>
              )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default Comedian;