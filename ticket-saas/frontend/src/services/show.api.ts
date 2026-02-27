import api from "./api";

export const createShowApi = (data: object) => api.post("/show", data);
export const getMyShowsApi = () => api.get("/show");
export const getShowByIdApi = (showId: string) => api.get(`/show/${showId}`);
export const updateShowApi = (showId: string, data: object) => api.put(`/show/${showId}`, data);
export const deleteShowApi = (showId: string) => api.delete(`/show/${showId}`);