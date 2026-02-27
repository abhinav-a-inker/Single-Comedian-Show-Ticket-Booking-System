import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes";
import { Request, Response } from "express";
import { authMiddleware } from "./middleware/auth.middleware";
import { requireRole } from "./middleware/role.middleware";
import adminRoutes from "./routes/admin.routes";
import clientRoutes from "./routes/client.routes";
import showRoutes from "./routes/show.routes";
import whatsappRoutes from "./routes/whatsapp.routes";
import { releaseExpiredSeats } from "./jobs/seatLock.job";
import path from "path";
import bookingRoutes from "./routes/booking.routes";
import revenueRoutes from "./routes/revenue.routes";
import scannerRoutes from "./routes/ticketscan.routes";
import overviewRouter from "./routes/overview.routes";


dotenv.config();

const app = express();
setInterval(releaseExpiredSeats, 60 * 1000);
app.use("/qr", express.static(path.join(__dirname, "../public/qr")));

app.use(cors());
app.use(express.json({ limit: "10mb" })); 
app.use(express.urlencoded({ extended: true, limit: "10mb" })); 

// Health check endpoint
app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/client", clientRoutes);
app.use("/api/show", showRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/revenue", revenueRoutes);
app.use("/api/scanner", scannerRoutes);
app.use("/api/overview", overviewRouter);

app.get(
  "/api/client/dashboard",
  authMiddleware,
  requireRole("CLIENT"),
  (req: Request, res: Response) => {
    res.json({
      success: true,
      message: "Client dashboard access granted",
    });
  }
);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Routes: /api/auth, /api/admin, /api/client, /api/show, /api/health`);
});