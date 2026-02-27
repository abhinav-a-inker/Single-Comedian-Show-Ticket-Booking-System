import { Router, Request, Response } from "express";
import { handleWhatsAppWebhook, verifyWebhook } from "../controllers/whatsapp.controller";

const router = Router();

// Meta verification handshake
router.get("/webhook", verifyWebhook);

// Incoming messages
router.post("/webhook", handleWhatsAppWebhook);

export default router;