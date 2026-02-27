import { Request, Response } from "express";
import { loginUser } from "../services/auth.service";

export const loginController = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await loginUser(email, password);
    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    return res.status(401).json({ success: false, message: error.message });
  }
};