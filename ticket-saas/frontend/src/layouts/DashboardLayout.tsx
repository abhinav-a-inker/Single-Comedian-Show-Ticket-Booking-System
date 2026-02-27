import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { clearToken, getRole, getName } from "../utils/token";

type Role = "ADMIN" | "CLIENT" | "TICKET_VALIDATOR";

const ALL_NAV = [
  { path: "/dashboard",          label: "Overview",       icon: "⬡", roles: ["ADMIN", "CLIENT"] },
  { path: "/dashboard/shows",    label: "Shows",          icon: "◉", roles: ["ADMIN", "CLIENT"] },
  { path: "/dashboard/create",   label: "Create Show",    icon: "+", roles: ["CLIENT"] },
  { path: "/dashboard/bookings", label: "Bookings",       icon: "◎", roles: ["ADMIN", "CLIENT"] },
  { path: "/dashboard/revenue",  label: "Revenue",        icon: "◈", roles: ["ADMIN", "CLIENT"] },
  { path: "/dashboard/scanner",  label: "Ticket Scanner", icon: "⊡", roles: ["TICKET_VALIDATOR"] },
];

const ACCENT: Record<Role, string> = {
  ADMIN: "#4A4A4A",           // Dark Gray – strong/admin feel
  CLIENT: "#4A4A4A",          // Dark Gray – clean & professional
  TICKET_VALIDATOR: "#AFAFAF", // Medium Gray – more subtle/validator role
};

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin Panel",
  CLIENT: "Comedian Panel",
  TICKET_VALIDATOR: "Validator Panel",
};

const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const role = (getRole() as Role) || "CLIENT";
  const name = getName();
  const accent = ACCENT[role] || "#4A4A4A";

  const logout = () => {
    clearToken();
    navigate("/login");
  };

  const visibleNav = ALL_NAV.filter((n) => n.roles.includes(role));

  const isActive = (path: string) => {
    if (path === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(path);
  };

  return (
    <div
      style={{
        fontFamily: "'DM Sans', sans-serif",
        background: "#FFFFFF",
        minHeight: "100vh",
        color: "#000000",
        display: "flex",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button, input, select, textarea { font-family: 'DM Sans', sans-serif; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #F9F9F9; }
        ::-webkit-scrollbar-thumb { background: #AFAFAF; border-radius: 10px; }
      `}</style>

      {/* Sidebar */}
      <div
        style={{
          width: 240,
          background: "#F9F9F9",
          borderRight: "1px solid #E5E5E5",
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          position: "fixed",
          boxShadow: "1px 0 6px rgba(0,0,0,0.04)",
        }}
      >
        {/* Logo / Header */}
        <div
          style={{
            padding: "28px 24px 20px",
            borderBottom: "1px solid #E5E5E5",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.12em",
              color: accent,
              textTransform: "uppercase",
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            Ticket SaaS
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#000000" }}>
            {ROLE_LABEL[role]}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "#AFAFAF",
              marginTop: 6,
              fontFamily: "Space Mono",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name || "User"}
          </div>
        </div>

        {/* Navigation */}
        <div style={{ flex: 1, padding: "0 8px" }}>
          {visibleNav.map((n) => {
            const active = isActive(n.path);
            return (
              <div
                key={n.path}
                onClick={() => navigate(n.path)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 20px",
                  cursor: "pointer",
                  background: active ? "#FFFFFF" : "transparent",
                  borderRadius: 10,
                  borderLeft: `3px solid ${active ? accent : "transparent"}`,
                  color: active ? "#000000" : "#4A4A4A",
                  fontSize: 14,
                  fontWeight: active ? 600 : 500,
                  transition: "all 0.18s ease",
                  margin: "4px 0",
                }}
              >
                <span style={{ fontSize: 16, minWidth: 20, textAlign: "center" }}>
                  {n.icon}
                </span>
                {n.label}
              </div>
            );
          })}
        </div>

        {/* Footer – Role badge + Logout */}
        <div style={{ padding: "20px 16px", borderTop: "1px solid #E5E5E5" }}>
          <div
            style={{
              padding: "8px 12px",
              background: "#FFFFFF",
              border: `1px solid ${accent}30`,
              borderRadius: 8,
              marginBottom: 16,
              textAlign: "center",
              fontSize: 12,
              fontWeight: 600,
              color: accent,
              letterSpacing: "0.04em",
            }}
          >
            {role}
          </div>

          <button
            onClick={logout}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: 10,
              background: "#000000",
              border: "none",
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              transition: "background 0.2s",
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        style={{
          marginLeft: 240,
          paddingLeft:"15px",
          paddingRight:"10px",
          flex: 1,
          minHeight: "100vh",
          background: "#FFFFFF",
        }}
      >
        <Outlet />
      </div>
    </div>
  );
};

export default DashboardLayout;