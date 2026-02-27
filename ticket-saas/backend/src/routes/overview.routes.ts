import { Router } from "express";
import { OverviewController } from "../controllers/overview.controller";
import { authMiddleware as authenticate } from "../middleware/auth.middleware";

const router = Router();
const controller = new OverviewController();

/**
 * GET /api/overview
 * Roles: ADMIN, CLIENT
 * Returns aggregated stats, charts, top shows, and recent activity logs.
 */
router.get("/", authenticate, (req, res) => controller.getOverview(req, res));

export default router;