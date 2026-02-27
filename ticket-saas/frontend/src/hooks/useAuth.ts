import { getRole, getToken, clearToken } from "../utils/token";
import { useNavigate } from "react-router-dom";

export const useAuth = () => {
  const navigate = useNavigate();
  const token = getToken();
  const role = getRole();

  const logout = () => {
    clearToken();
    navigate("/login");
  };

  return { token, role, logout, isLoggedIn: !!token };
};