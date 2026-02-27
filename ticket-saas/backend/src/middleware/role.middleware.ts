import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";

export const requireRole =
  (role: "ADMIN" | "CLIENT") =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    console.log("[INFO] requireRole:", role, "req.user =", req.user);
    
    if (!req.user || req.user.role !== role) {
      console.log("[WARN] requireRole: Access denied. Expected role:", role, "Got:", req.user?.role);
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    next();
  };
