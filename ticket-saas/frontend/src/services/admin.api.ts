import api from "./api";

export const getClientProfileApi = () => api.get("/admin/client");

export const updateClientStatusApi = (action: string) =>
  api.patch("/admin/client/status", { action });

export const getClientShowsApi = () => api.get("/admin/client/shows");

export const getShowBookingsApi = (
  showId: string,
  status?: string,
  search?: string
) => api.get(`/admin/shows/${showId}/bookings`, { params: { status, search } });