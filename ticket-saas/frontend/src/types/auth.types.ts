export type Role = "ADMIN" | "CLIENT";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterClientPayload {
  email: string;
  password: string;
  fullName: string;
  companyName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  businessRegNo?: string;
  gstNumber?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    role: Role;
  };
}

export interface User {
  token: string;
  role: Role;
}