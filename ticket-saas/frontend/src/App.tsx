import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthLayout from "./layouts/AuthLayout";
import DashboardLayout from "./layouts/DashboardLayout";
import Login from "./pages/auth/Login";
import ProtectedRoute from "./components/common/ProtectedRoute";
import Overview from "./pages/dashboard/Overview";
import Shows from "./pages/dashboard/Shows";
import CreateShow from "./pages/dashboard/CreateShow";
import EditShow from "./pages/dashboard/EditShow";
import Bookings from "./pages/dashboard/Bookings";
import Revenue from "./pages/dashboard/Revenue";
import Scanner from "./pages/dashboard/Scanner";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Auth ── */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
        </Route>

        <Route
          path="/dashboard/scanner"
          element={
            <ProtectedRoute allowedRoles={["TICKET_VALIDATOR", "ADMIN"]}>
              <Scanner />
            </ProtectedRoute>
          }
        />

        {/* ── Dashboard — with sidebar, ADMIN and CLIENT only ──
            TICKET_VALIDATOR is intentionally excluded here so they
            can't reach Overview/Shows/Bookings/Revenue at all. */}
        <Route
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "CLIENT"]}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard"                     element={<Overview />} />
          <Route path="/dashboard/shows"               element={<Shows />} />
          <Route path="/dashboard/create"              element={<CreateShow />} />
          <Route path="/dashboard/show/:showId/edit"   element={<EditShow />} />
          <Route path="/dashboard/bookings"            element={<Bookings />} />
          <Route path="/dashboard/revenue"             element={<Revenue />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;