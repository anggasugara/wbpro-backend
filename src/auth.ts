import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Request, Response, NextFunction } from "express";

const secret = process.env.JWT_SECRET || "dev-secret-change-me";

export function signUser(user: { id: string; workspaceId: string; role: string }) {
  return jwt.sign(
    {
      sub: user.id,
      workspaceId: user.workspaceId,
      role: user.role
    },
    secret,
    { expiresIn: "7d" }
  );
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export type AuthRequest = Request & {
  user?: {
    id: string;
    workspaceId: string;
    role: string;
  };
};

export function auth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const token = (req.headers.authorization || "").replace(
    /^Bearer\s+/i,
    ""
  );

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    req.user = jwt.verify(token, secret) as AuthRequest["user"];
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}
