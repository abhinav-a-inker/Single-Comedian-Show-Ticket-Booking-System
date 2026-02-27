import { Request, Response } from "express";
import { OverviewService } from "../services/overview.service";
const service = new OverviewService();

export class OverviewController {
  async getOverview(req: Request, res: Response) {
    try {
      // Assumes your auth middleware attaches user to req (req.user)
      const { id: loginId, role } = (req as any).user;

      if (role === "TICKET_VALIDATOR") {
        return res.status(403).json({ message: "Access denied" });
      }

      const data = await service.getOverview(loginId, role);
      return res.json(data);
    } catch (err: any) {
      console.error("[OverviewController] getOverview error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}