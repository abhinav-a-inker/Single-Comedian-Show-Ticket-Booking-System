import { Router } from "express";
import {
  getClientProfile,
  updateClientStatus,
  getAdminClientShows,
  getShowBookings,
} from "../controllers/admin.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.use(authMiddleware, requireRole("ADMIN"));

router.get("/client", getClientProfile);
router.patch("/client/status", updateClientStatus);
router.get("/client/shows", getAdminClientShows);
router.get("/shows/:showId/bookings", getShowBookings);

export default router;