import { Router } from "express";
import {
  createShowController,
  getMyShowsController,
  getShowByIdController,
  updateShowController,
  deleteShowController,
} from "../controllers/show.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.use(authMiddleware);

router.post("/", createShowController);
router.get("/", getMyShowsController);
router.get("/:showId", getShowByIdController);
router.put("/:showId", updateShowController);
router.delete("/:showId", deleteShowController);

export default router;