import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: "ADMIN" | "CLIENT";
  };
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    console.log("[INFO] authMiddleware: authHeader =", authHeader ? "***present***" : "missing");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("[WARN] authMiddleware: No Bearer token found");
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix

    if (!token) {
      console.log("[WARN] authMiddleware: Token is empty");
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const decoded = verifyToken(token);
    console.log("[INFO] authMiddleware: decoded =", { id: decoded.id, role: decoded.role });

    req.user = decoded;

    next();
  } catch (error) {
    console.error("[ERROR] authMiddleware:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};
