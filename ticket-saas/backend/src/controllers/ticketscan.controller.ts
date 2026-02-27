import { Request, Response } from "express";
import {
  getValidatorShowsService,
  getScanStatsService,
  verifyTicketService,
  getScanHistoryService,
} from "../services/ticketScan.service";

// GET /api/scanner/shows
export const getValidatorShows = async (req: Request, res: Response) => {
  try {
    const { id: loginId, role } = (req as any).user;
    const data = await getValidatorShowsService(loginId, role);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// GET /api/scanner/stats?showId=xxx
export const getScanStats = async (req: Request, res: Response) => {
  try {
    const showId = req.query.showId as string;
    if (!showId) {
      res.status(400).json({ success: false, message: "showId is required" });
      return;
    }
    const data = await getScanStatsService(showId);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// POST /api/scanner/verify
// Body: { bookingRef: string, showId: string }
export const verifyTicket = async (req: Request, res: Response) => {
  try {
    const { id: scannedById } = (req as any).user;
    const { bookingRef, showId } = req.body;

    if (!bookingRef || !showId) {
      res.status(400).json({
        success: false,
        message: "bookingRef and showId are required",
      });
      return;
    }

    // Safety strip — QR format is TICKET:{bookingRef}:{showId}
    // Frontend already strips this, but guard here too in case raw value arrives
    const rawRef   = String(bookingRef).trim().toUpperCase();
    const parts    = rawRef.split(":");
    const cleanRef = parts[0] === "TICKET" && parts.length >= 2 ? parts[1] : parts[0];

    const deviceInfo = req.headers["user-agent"];

    const data = await verifyTicketService(cleanRef, showId, scannedById, deviceInfo);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// GET /api/scanner/history?showId=xxx&limit=100
export const getScanHistory = async (req: Request, res: Response) => {
  try {
    const showId = req.query.showId as string;
    const limit  = req.query.limit ? parseInt(req.query.limit as string) : 100;

    if (!showId) {
      res.status(400).json({ success: false, message: "showId is required" });
      return;
    }

    const data = await getScanHistoryService(showId, limit);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};