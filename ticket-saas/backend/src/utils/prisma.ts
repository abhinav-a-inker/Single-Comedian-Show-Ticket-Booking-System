import dotenv from "dotenv";
dotenv.config(); // Must be at the top before anything else

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

console.log("[DEBUG] DIRECT_URL:", process.env.DIRECT_URL ? "*** (set)" : "undefined");

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || "",
});

if (!process.env.DIRECT_URL) {
  console.warn("[WARN] DIRECT_URL environment variable is not set!");
}

const prisma = new PrismaClient({ adapter });;

export default prisma;