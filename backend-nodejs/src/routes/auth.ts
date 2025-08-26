import express from "express";
import { AppDataSource } from "../data-source";
import { Employee } from "../entities/Employee";

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
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: "email required" });
    }

    const lowered = String(email).trim().toLowerCase();
    // Use a core-column-only query to be resilient if schema migrations are pending
    const row = await AppDataSource
      .createQueryBuilder()
      .select(["e.id", "e.name", "e.email", "e.role"])
      .from(Employee, "e")
      .where("LOWER(e.email) = :email", { email: lowered })
      .getRawOne();

    if (!row) {
      return res.status(401).json({ 
        error: "Ukjent e-post. Kontakt administrator for tilgang." 
      });
    }

    // Set session
    req.session.userId = row.e_id || row.id || row.ID || row.Id;
    req.session.user = {
      id: row.e_id ?? row.id,
      email: row.e_email ?? row.email ?? "",
      name: row.e_name ?? row.name,
      role: row.e_role ?? row.role ?? "",
    };

    res.json({
      user: {
        id: req.session.user.id,
        email: req.session.user.email,
        name: req.session.user.name,
        role: req.session.user.role,
      }
    });
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
