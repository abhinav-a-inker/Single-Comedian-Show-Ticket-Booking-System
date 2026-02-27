import { Request, Response } from "express";
import {
  debugBookingsService,
  getShowsListService,
  getBookingsService,
  getShowStatsService,
} from "../services/booking.service";

// GET /api/bookings/debug
// Open this in browser/Postman to see what's actually in your DB
export const debugBookings = async (req: Request, res: Response) => {
  try {
    const { id: loginId, role } = (req as any).user;
    const data = await debugBookingsService(loginId, role);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/bookings/shows
export const getShowsList = async (req: Request, res: Response) => {
  try {
    const { id: loginId, role } = (req as any).user;
    const data = await getShowsListService(loginId, role);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// GET /api/bookings
// GET /api/bookings?showId=xxx
export const getBookings = async (req: Request, res: Response) => {
  try {
    const { id: loginId, role } = (req as any).user;
    const showId = req.query.showId as string | undefined;
    const data = await getBookingsService(loginId, role, showId);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// GET /api/bookings/stats?showId=xxx
export const getShowStats = async (req: Request, res: Response) => {
  try {
    const { id: loginId, role } = (req as any).user;
    const showId = req.query.showId as string;
    if (!showId) {
      res.status(400).json({ success: false, message: "showId query param is required" });
      return;
    }
    const data = await getShowStatsService(showId, loginId, role);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};