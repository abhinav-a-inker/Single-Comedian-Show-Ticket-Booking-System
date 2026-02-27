import bcrypt from "bcrypt";
import prisma from "../utils/prisma";
import { generateToken } from "../utils/jwt";

export const loginUser = async (email: string, password: string) => {
  const user = await prisma.login.findUnique({
    where: { email },
  });

  if (!user) throw new Error("Invalid credentials");

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Error("Invalid credentials");

  const token = generateToken({ id: user.id, role: user.role });

  return { token, role: user.role, name: user.name };
};