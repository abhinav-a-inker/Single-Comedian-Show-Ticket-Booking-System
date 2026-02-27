import { Router } from "express";
import {
  debugBookings,
  getShowsList,
  getBookings,
  getShowStats,
} from "../controllers/booking.controller";
import { authMiddleware as authenticate } from "../middleware/auth.middleware";

const router = Router();
router.use(authenticate);

// ⚠️  ORDER MATTERS — specific paths before generic ones

// GET /api/bookings/debug   → shows what's in DB (use this to diagnose)
router.get("/debug",  debugBookings);

// GET /api/bookings/shows   → shows list for dropdown
router.get("/shows",  getShowsList);

// GET /api/bookings/stats?showId=xxx
router.get("/stats",  getShowStats);

// GET /api/bookings
// GET /api/bookings?showId=xxx
router.get("/",       getBookings);

export default router;