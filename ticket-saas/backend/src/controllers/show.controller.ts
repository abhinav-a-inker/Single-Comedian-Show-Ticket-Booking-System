import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import {
  createShowService,
  getMyShowsService,
  getShowByIdService,
  updateShowService,
  deleteShowService,
} from "../services/show.service";

export const createShowController = async (req: AuthRequest, res: Response) => {
  try {
    const show = await createShowService(req.user!.id, req.body);
    res.status(201).json({ success: true, message: "Show created successfully", data: show });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getMyShowsController = async (req: AuthRequest, res: Response) => {
  try {
    // ✅ FIX 1: was getMyShowsService(req.user!.id) — missing role
    const shows = await getMyShowsService(req.user!.id, req.user!.role);
    res.json({ success: true, data: shows });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getShowByIdController = async (req: AuthRequest, res: Response) => {
  try {
    const show = await getShowByIdService(req.params.showId, req.user!.id, req.user!.role);
    res.json({ success: true, data: show });
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message });
  }
};

export const updateShowController = async (req: AuthRequest, res: Response) => {
  try {
    const showId = req.params.showId as string;
    if (!showId) {
      res.status(400).json({ success: false, message: "Show ID is required" });
      return;
    }
    // ✅ FIX 2: was updateShowService(showId, req.user!.id, req.body) — missing role
    const show = await updateShowService(showId, req.user!.id, req.user!.role, req.body);
    res.json({ success: true, message: "Show updated successfully", data: show });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteShowController = async (req: AuthRequest, res: Response) => {
  try {
    await deleteShowService(req.params.showId, req.user!.id, req.user!.role);
    res.json({ success: true, message: "Show deleted" });
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message });
  }
};