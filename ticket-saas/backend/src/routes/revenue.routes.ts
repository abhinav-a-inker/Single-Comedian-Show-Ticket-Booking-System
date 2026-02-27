import { Router } from "express";
import {
  getRevenueShows,
  getRevenueSummary,
  getRevenueByShow,
  getRevenueTransactions,
} from "../controllers/revenue.controller";
import { authMiddleware as authenticate } from "../middleware/auth.middleware";

const router = Router();
router.use(authenticate);

// GET /api/revenue/shows              → shows list for dropdown
router.get("/shows",            getRevenueShows);

// GET /api/revenue/summary            → global KPI cards
// GET /api/revenue/summary?showId=xxx → KPIs for one show
router.get("/summary",          getRevenueSummary);

// GET /api/revenue/shows-breakdown    → per-show revenue table
router.get("/shows-breakdown",  getRevenueByShow);

// GET /api/revenue/transactions       → all paid transactions
// GET /api/revenue/transactions?showId=xxx
router.get("/transactions",     getRevenueTransactions);

export default router;

/*
─── Add to server.ts ─────────────────────────────────────────────────────────

  import revenueRoutes from "./routes/revenue.routes";
  app.use("/api/revenue", revenueRoutes);

─────────────────────────────────────────────────────────────────────────────
*/