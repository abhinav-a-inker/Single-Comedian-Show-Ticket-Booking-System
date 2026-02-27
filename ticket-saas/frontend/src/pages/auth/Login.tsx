import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { setToken } from "../../utils/token";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

 const handleLogin = async (e?: React.FormEvent) => {
  e?.preventDefault();
  setLoading(true);
  setError("");
  try {
    const res = await api.post("/auth/login", { email, password });
    const { token, role, name } = res.data;
    setToken(token, role, name || "");
   
    if (role === "TICKET_VALIDATOR") {
      navigate("/dashboard/scanner");
    } else {
      navigate("/dashboard");
    }
  } catch (err: any) {
    setError(err.response?.data?.message || "Login failed");
  } finally {
    setLoading(false);
  }
};

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#FFFFFF", border: "1px solid #000000",
    borderRadius: 10, color: "#000000", padding: "12px 14px",
    fontSize: 14, outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&family=Space+Mono&display=swap');`}</style>

      <div style={{ width: 380, background: "#FFFFFF", border: "1px solid #000000", borderRadius: 20, padding: 36 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: "#000000", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>Ticket Booking Platform</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#000000" }}>Welcome back</h1>
          <p style={{ fontSize: 13, color: "#000000", marginTop: 4 }}>Sign in to your account</p>
        </div>

        {error && (
          <div style={{ background: "#FF555511", border: "1px solid #FF555533", borderRadius: 10, padding: "10px 14px", color: "#FF5555", fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* ✅ Wrapped in form — fixes browser warning + enables Enter key submit */}
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: "#000000", display: "block", marginBottom: 6 }}>Email</label>
            <input
              style={inputStyle}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 12, color: "#000000", display: "block", marginBottom: 6 }}>Password</label>
            <input
              style={inputStyle}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", padding: "13px", borderRadius: 10, background: loading ? "#E5E5E5" : "#000000", border: "none", color: loading ? "#000000" : "#FFFFFF", fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;