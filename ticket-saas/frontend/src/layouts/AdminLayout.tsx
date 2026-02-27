import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { clearToken } from "../utils/token";

const NAV = [
  { path: "/admin/dashboard", label: "Overview", icon: "⬡" },
  { path: "/admin/comedian", label: "Comedian", icon: "◈" },
  { path: "/admin/shows", label: "Shows", icon: "◉" },
  { path: "/admin/bookings", label: "Bookings", icon: "◎" },
];

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const logout = () => {
    clearToken();
    navigate("/login");
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#0F0F13", minHeight: "100vh", color: "#E8E8F0", display: "flex" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button { font-family: 'DM Sans', sans-serif; }
      `}</style>

      {/* Sidebar */}
      <div style={{ width: 220, background: "#0D0D11", borderRight: "1px solid #1A1A24", display: "flex", flexDirection: "column", padding: "28px 0", height: "100vh", position: "fixed" }}>
        <div style={{ padding: "0 24px 28px" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#6C63FF", textTransform: "uppercase", marginBottom: 4 }}>Ticket SaaS</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#E8E8F0" }}>Admin Panel</div>
        </div>
        <div style={{ flex: 1 }}>
          {NAV.map((n) => {
            const active = location.pathname === n.path;
            return (
              <div key={n.path} onClick={() => navigate(n.path)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 24px", cursor: "pointer", background: active ? "#6C63FF11" : "transparent", borderLeft: `3px solid ${active ? "#6C63FF" : "transparent"}`, color: active ? "#E8E8F0" : "#555", fontSize: 14, fontWeight: active ? 600 : 400, transition: "all 0.15s", marginBottom: 2 }}>
                <span style={{ fontSize: 16 }}>{n.icon}</span>
                {n.label}
              </div>
            );
          })}
        </div>
        <div style={{ padding: "0 16px" }}>
          <button onClick={logout} style={{ width: "100%", padding: "10px", borderRadius: 10, background: "transparent", border: "1px solid #23232F", color: "#555", cursor: "pointer", fontSize: 13 }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Page Content */}
      <div style={{ marginLeft: 220, padding: "36px 40px", flex: 1 }}>
        <Outlet />
      </div>
    </div>
  );
};

export default AdminLayout;