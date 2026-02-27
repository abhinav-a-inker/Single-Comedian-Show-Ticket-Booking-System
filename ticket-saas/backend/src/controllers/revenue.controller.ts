import { Request, Response } from "express";
import {
  getRevenueShowsService,
  getRevenueSummaryService,
  getRevenueByShowService,
  getRevenueTransactionsService,
} from "../services/revenue.service";

// GET /api/revenue/shows
export const getRevenueShows = async (req: Request, res: Response) => {
  try {
    const { id: loginId, role } = (req as any).user;
    const data = await getRevenueShowsService(loginId, role);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// GET /api/revenue/summary
// GET /api/revenue/summary?showId=xxx
export const getRevenueSummary = async (req: Request, res: Response) => {
  try {
    const { id: loginId, role } = (req as any).user;
    const showId = req.query.showId as string | undefined;
    const data = await getRevenueSummaryService(loginId, role, showId);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// GET /api/revenue/shows-breakdown
export const getRevenueByShow = async (req: Request, res: Response) => {
  try {
    const { id: loginId, role } = (req as any).user;
    const data = await getRevenueByShowService(loginId, role);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// GET /api/revenue/transactions
// GET /api/revenue/transactions?showId=xxx
export const getRevenueTransactions = async (req: Request, res: Response) => {
  try {
    const { id: loginId, role } = (req as any).user;
    const showId = req.query.showId as string | undefined;
    const data = await getRevenueTransactionsService(loginId, role, showId);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};