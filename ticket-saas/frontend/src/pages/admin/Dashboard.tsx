import { useAuth } from "../../hooks/useAuth";

const AdminDashboard = () => {
  const { logout } = useAuth();
  return (
    <div style={{ minHeight: "100vh", background: "#0F0F13", color: "#E8E8F0", fontFamily: "DM Sans, sans-serif", padding: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 40 }}>
        <div>
          <div style={{ fontSize: 11, color: "#6C63FF", letterSpacing: "0.1em", textTransform: "uppercase" }}>Ticket SaaS</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>Admin Dashboard</h1>
        </div>
        <button onClick={logout} style={{ padding: "10px 20px", borderRadius: 10, background: "transparent", border: "1px solid #2A2A38", color: "#888", cursor: "pointer", fontFamily: "DM Sans" }}>Logout</button>
      </div>
      <p style={{ color: "#555" }}>Admin panel coming soon...</p>
    </div>
  );
};

export default AdminDashboard;