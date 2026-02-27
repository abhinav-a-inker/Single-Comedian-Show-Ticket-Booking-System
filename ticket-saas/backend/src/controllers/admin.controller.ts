import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import {
  getClientProfileService,
  updateClientStatusService,
  getClientShowsService,
  getShowBookingsService,
  deleteShowService,
} from "../services/admin.service";

export const getClientProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const client = await getClientProfileService();
    res.json({ success: true, data: client });
  } catch (error: any) {
    console.error("[ERROR] getClientProfile:", error.message);
    res.status(404).json({ success: false, message: error.message });
  }
};

export const updateClientStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { action } = req.body;
    if (!action) {
      res.status(400).json({ success: false, message: "Action is required" });
      return;
    }
    const client = await updateClientStatusService(action);
    res.json({ success: true, message: `Client ${action}D successfully`, data: client });
  } catch (error: any) {
    console.error("[ERROR] updateClientStatus:", error.message);
    res.status(404).json({ success: false, message: error.message });
  }
};

export const getAdminClientShows = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const client = await getClientProfileService();
    const shows = await getClientShowsService(client.id);
    res.json({ success: true, data: shows });
  } catch (error: any) {
    console.error("[ERROR] getAdminClientShows:", error.message);
    res.status(404).json({ success: false, message: error.message });
  }
};

export const getClientShows = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const shows = await getClientShowsService(req.user.id);
    res.json({ success: true, data: shows });
  } catch (error: any) {
    console.error("[ERROR] getClientShows:", error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getShowBookings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const showId = req.params.showId as string;
    if (!showId) {
      res.status(400).json({ success: false, message: "showId is required" });
      return;
    }
    const { status, search } = req.query;
    const bookings = await getShowBookingsService(
      showId,
      status as string,
      search as string
    );
    res.json({ success: true, data: bookings });
  } catch (error: any) {
    console.error("[ERROR] getShowBookings:", error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteShow = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const showId = req.params.showId as string;
    if (!showId) {
      res.status(400).json({ success: false, message: "showId is required" });
      return;
    }
    await deleteShowService(showId, req.user.id);
    res.json({ success: true, message: "Show deleted successfully" });
  } catch (error: any) {
    console.error("[ERROR] deleteShow:", error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};