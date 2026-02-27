export const getToken = () => localStorage.getItem("token");
export const getRole = () => localStorage.getItem("role") as "ADMIN" | "CLIENT" | "TICKET_VALIDATOR" | null;
export const getName = () => localStorage.getItem("name") || "";

export const setToken = (token: string, role: string, name: string) => {
  localStorage.setItem("token", token);
  localStorage.setItem("role", role);
  localStorage.setItem("name", name);
};

export const clearToken = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("name");
};