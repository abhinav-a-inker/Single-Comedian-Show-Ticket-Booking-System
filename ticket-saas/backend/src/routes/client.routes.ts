import { Router } from "express";
import {
  getClientShows,
  getShowBookings,
  deleteShow,
} from "../controllers/admin.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.use(authMiddleware, requireRole("CLIENT"));

router.get("/shows", getClientShows);
router.delete("/shows/:showId", deleteShow);
router.get("/show/:showId/bookings", getShowBookings);

export default router;
