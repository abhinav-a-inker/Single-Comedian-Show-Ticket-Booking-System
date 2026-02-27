import { Router } from "express";
import {
  getValidatorShows,
  getScanStats,
  verifyTicket,
  getScanHistory,
} from "../controllers/ticketScan.controller";
import { authMiddleware as authenticate } from "../middleware/auth.middleware";

const router = Router();

// All scanner routes require a valid JWT.
// Roles allowed: TICKET_VALIDATOR, CLIENT, ADMIN
router.use(authenticate);

// GET  /api/scanner/shows              → event dropdown for the validator
router.get("/shows",   getValidatorShows);

// GET  /api/scanner/stats?showId=xxx   → live Total / Checked In / Pending / Invalid counts
router.get("/stats",   getScanStats);

// GET  /api/scanner/history?showId=xxx → scan log (reads from TicketScan table)
router.get("/history", getScanHistory);

// POST /api/scanner/verify             → verify a QR scan, writes to TicketScan table
router.post("/verify", verifyTicket);

export default router;