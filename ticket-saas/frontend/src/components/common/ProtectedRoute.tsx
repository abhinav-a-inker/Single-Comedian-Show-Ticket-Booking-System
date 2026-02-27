import { Navigate } from "react-router-dom";
import { getToken, getRole } from "../../utils/token";

type Role = "ADMIN" | "CLIENT" | "TICKET_VALIDATOR";

interface Props {
  children: React.ReactNode;
  allowedRoles: Role[];
}

const ProtectedRoute = ({ children, allowedRoles }: Props) => {
  const token = getToken();
  const role = getRole();
  if (!token) return <Navigate to="/login" />;
  if (!role || !allowedRoles.includes(role)) return <Navigate to="/login" />;
  return <>{children}</>;
};

export default ProtectedRoute;