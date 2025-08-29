import express from "express";
import { AppDataSource } from "../data-source";
import { Employee } from "../entities/Employee";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const router = express.Router();

// Extend session to include user
declare module "express-session" {
  interface SessionData {
    userId?: number;
    user?: {
      id: number;
      email: string;
      name: string;
      role: string;
    };
  }
}

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
  const { email, password } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: "email required" });
    }

    const lowered = String(email).trim().toLowerCase();
    // Use a core-column-only query to be resilient if schema migrations are pending
    const row = await AppDataSource
      .createQueryBuilder()
      .select(["e.id", "e.name", "e.email", "e.role", "e.password_hash"])
      .from(Employee, "e")
      .where("LOWER(e.email) = :email", { email: lowered })
      .getRawOne();

    if (!row) {
      return res.status(401).json({ 
        error: "Ukjent e-post. Kontakt administrator for tilgang." 
      });
    }

    // If user has a password_hash set, require correct password; else allow legacy email-only login
    const dbHash = row.e_password_hash ?? row.password_hash;
    if (dbHash) {
      if (!password || typeof password !== 'string' || password.length < 1) {
        return res.status(401).json({ error: "Passord kreves for denne brukeren" });
      }
      const ok = await bcrypt.compare(password, dbHash);
      if (!ok) return res.status(401).json({ error: "Ugyldig e-post eller passord" });
    }

    // Set session
    req.session.userId = row.e_id || row.id || row.ID || row.Id;
    req.session.user = {
      id: row.e_id ?? row.id,
      email: row.e_email ?? row.email ?? "",
      name: row.e_name ?? row.name,
      role: row.e_role ?? row.role ?? "",
    };

    const payload = {
      sub: req.session.user.id,
      email: req.session.user.email,
      name: req.session.user.name,
      role: req.session.user.role,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET || (process.env.SECRET_KEY || "dev-secret-change-me"), { expiresIn: "12h" });
    res.json({ user: payload, token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
    }
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

// GET /api/auth/whoami
router.get("/whoami", async (req, res) => {
  if (!req.session.userId) {
    return res.json({ authenticated: false });
  }

  try {
    // Core-column-only whoami to avoid dependency on pending migrations
    const row = await AppDataSource
      .createQueryBuilder()
      .select(["e.id", "e.name", "e.email", "e.role"])
      .from(Employee, "e")
      .where("e.id = :id", { id: req.session.userId })
      .getRawOne();

    if (!row) {
      return res.json({ authenticated: false });
    }

    res.json({
      authenticated: true,
      user: {
        id: row.e_id ?? row.id,
        email: row.e_email ?? row.email,
        name: row.e_name ?? row.name,
        role: row.e_role ?? row.role,
      }
    });
  } catch (error) {
    console.error("Whoami error:", error);
    res.json({ authenticated: false });
  }
});

export default router;
// Compatibility aliases per spec
// GET /api/auth/me -> whoami
router.get("/me", (req, res, next) => (router as any).handle({ ...req, url: "/whoami", method: "GET" }, res, next));

// POST /api/auth/register - not implemented in our model (use /api/employees instead)
router.post("/register", (_req, res) => {
  res.status(501).json({ error: "Not implemented. Create users via /api/employees." });
});

// JWT guard middleware (optional usage in other routers if needed)
export function requireJwt(req: any, res: any, next: any) {
  try {
    const h = req.headers?.authorization || "";
    const t = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!t) return res.status(401).json({ error: "Missing token" });
    const decoded = jwt.verify(t, process.env.JWT_SECRET || (process.env.SECRET_KEY || "dev-secret-change-me"));
    (req as any).jwt = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// Require one of the provided roles (e.g., 'admin', 'manager')
export function requireRole(...roles: string[]) {
  return function (req: any, res: any, next: any) {
    const role = req?.jwt?.role || req?.session?.user?.role;
    if (!role) return res.status(403).json({ error: "Forbidden" });
    if (!roles.includes(String(role).toLowerCase())) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  };
}

// Common helper for admin-level access (admin or manager)
export const requireAdmin = () => requireRole("admin", "manager");
