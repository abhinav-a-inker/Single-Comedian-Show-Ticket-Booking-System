import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { clearToken } from "../utils/token";

const NAV = [
  { path: "/client/dashboard", label: "My Shows", icon: "◉" },
  { path: "/client/show/create", label: "Create Show", icon: "+" },
];

const ClientLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const logout = () => {
    clearToken();
    navigate("/login");
  };

  const isActive = (path: string) => {
    if (path === "/client/dashboard") {
      return (
        location.pathname === "/client/dashboard" ||
        location.pathname.includes("/edit")
      );
    }
    return location.pathname === path;
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#0F0F13", minHeight: "100vh", color: "#E8E8F0", display: "flex" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button { font-family: 'DM Sans', sans-serif; }
        input, select, textarea { font-family: 'DM Sans', sans-serif; }
      `}</style>

      {/* Sidebar */}
      <div style={{ width: 220, background: "#0D0D11", borderRight: "1px solid #1A1A24", display: "flex", flexDirection: "column", padding: "28px 0", height: "100vh", position: "fixed" }}>
        <div style={{ padding: "0 24px 28px" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#00D4A1", textTransform: "uppercase", marginBottom: 4 }}>Ticket SaaS</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#E8E8F0" }}>Comedian Panel</div>
        </div>

        <div style={{ flex: 1 }}>
          {NAV.map((n) => {
            const active = isActive(n.path);
            return (
              <div
                key={n.path}
                onClick={() => navigate(n.path)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 24px", cursor: "pointer",
                  background: active ? "#00D4A111" : "transparent",
                  borderLeft: `3px solid ${active ? "#00D4A1" : "transparent"}`,
                  color: active ? "#E8E8F0" : "#555",
                  fontSize: 14, fontWeight: active ? 600 : 400,
                  transition: "all 0.15s", marginBottom: 2,
                }}
              >
                <span style={{ fontSize: 16 }}>{n.icon}</span>
                {n.label}
              </div>
            );
          })}
        </div>

        {/* Bottom info + logout */}
        <div style={{ padding: "0 16px 0" }}>
          <div style={{ padding: "12px 16px", background: "#0F0F13", borderRadius: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "#333", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Current Page</div>
            <div style={{ fontSize: 12, color: "#555", fontFamily: "Space Mono" }}>
              {location.pathname.includes("/edit") ? "Editing Show" :
               location.pathname.includes("/create") ? "Create Show" :
               "My Shows"}
            </div>
          </div>
          <button
            onClick={logout}
            style={{ width: "100%", padding: "10px", borderRadius: 10, background: "transparent", border: "1px solid #23232F", color: "#555", cursor: "pointer", fontSize: 13 }}
          >
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

export default ClientLayout;