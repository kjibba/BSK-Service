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

// Helper: fetch role for a user id; returns empty string if column/schema missing or value null
async function fetchUserRole(userId: number): Promise<string> {
  try {
    const row = await AppDataSource
      .createQueryBuilder()
      .select(["e.role"]).from(Employee, "e")
      .where("e.id = :id", { id: userId })
      .getRawOne();
    const r = (row?.e_role ?? row?.role ?? "").toString().toLowerCase();
    return r;
  } catch {
    return "";
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
    // Select only columns that we know exist across legacy schemas
    const row = await AppDataSource
      .createQueryBuilder()
      .select(["e.id", "e.name", "e.email", "e.password_hash"]) // omit role for compatibility
      .from(Employee, "e")
      .where("LOWER(e.email) = :email", { email: lowered })
      .getRawOne();

    if (!row) {
      return res.status(401).json({ 
        error: "Ukjent e-post. Kontakt administrator for tilgang." 
      });
    }

    // If user has a password_hash set, require correct password; if missing, instruct client to set initial password
    const dbHash = row.e_password_hash ?? row.password_hash;
    if (dbHash) {
      if (!password || typeof password !== 'string' || password.length < 1) {
        return res.status(401).json({ error: "Passord kreves for denne brukeren" });
      }
      const ok = await bcrypt.compare(password, dbHash);
      if (!ok) return res.status(401).json({ error: "Ugyldig e-post eller passord" });
    } else {
      // No password set -> signal to client that initial password setup is required
      return res.status(409).json({ error: "Passord må settes for denne brukeren", requiresPassword: true });
    }

    // Set session (regenerate to avoid fixation) and include role if available
    const uid = row.e_id ?? row.id;
    const role = await fetchUserRole(uid);
    req.session.regenerate((err) => {
      if (err) {
        console.error("Session regenerate error:", err);
        return res.status(500).json({ error: "Login failed" });
      }
      req.session.userId = uid;
      req.session.user = {
        id: uid,
        email: row.e_email ?? row.email ?? "",
        name: row.e_name ?? row.name,
        role,
      };
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("Session save error:", saveErr);
          return res.status(500).json({ error: "Login failed" });
        }
        const payload = {
          sub: req.session.user!.id,
          email: req.session.user!.email,
          name: req.session.user!.name,
          role: req.session.user!.role,
        } as any;
        const token = jwt.sign(payload, process.env.JWT_SECRET || (process.env.SECRET_KEY || "dev-secret-change-me"), { expiresIn: "12h" });
        return res.json({ user: payload, token });
      });
    });
  } catch (error) {
    console.error("Login error:", (error as any)?.message || error);
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /api/auth/set_password
// - Krever innlogget sesjon (brukeren har nettopp passert login med email-only)
// - Tillates kun hvis brukeren ikke har satt passord tidligere (password_hash er NULL)
router.post("/set_password", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Ikke innlogget" });
    }
    const { password } = req.body || {};
    if (!password || typeof password !== "string" || password.trim().length < 8) {
      return res.status(400).json({ error: "Passord må være minst 8 tegn" });
    }

    const repo = AppDataSource.getRepository(Employee);
    // Minimal fetch (raw) to avoid selecting non-existent columns in legacy DBs
    const row = await AppDataSource
      .createQueryBuilder()
      .select(["e.id", "e.password_hash"]).from(Employee, "e")
      .where("e.id = :id", { id: req.session.userId })
      .getRawOne();
    if (!row) return res.status(404).json({ error: "Bruker ikke funnet" });
    const has = Boolean(row.e_password_hash ?? row.password_hash);
    if (has) return res.status(400).json({ error: "Passord er allerede satt" });

    const hash = await bcrypt.hash(password, 10);
    await repo.createQueryBuilder()
      .update(Employee)
      .set({ passwordHash: hash })
      .where("id = :id", { id: row.e_id ?? row.id })
      .execute();
    // Issue JWT so client can access JWT-protected endpoints immediately
    try {
      const u = (req as any).session?.user || { id: req.session.userId, email: undefined, name: undefined, role: "" };
      // Refresh role from DB if missing
      if (!u.role) {
        try { (u as any).role = await fetchUserRole(u.id); } catch {}
      }
      const payload = {
        sub: u.id,
        email: u.email || "",
        name: u.name || "",
        role: u.role || "",
      } as any;
      // Sørg for at sesjonen er lagret før svar
      req.session.save(() => {
        const token = jwt.sign(payload, process.env.JWT_SECRET || (process.env.SECRET_KEY || "dev-secret-change-me"), { expiresIn: "12h" });
        return res.json({ ok: true, token, user: payload });
      });
    } catch {
      return res.json({ ok: true });
    }
  } catch (e) {
    console.error("set_password error:", e);
    return res.status(500).json({ error: "Kunne ikke sette passord" });
  }
});

// POST /api/auth/set_initial_password
// - For førstegangsoppsett: krever IKKE innlogget sesjon
// - Setter passord dersom brukeren eksisterer og ikke har passord fra før
router.post("/set_initial_password", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "E-post kreves" });
    }
    if (!password || typeof password !== "string" || password.trim().length < 8) {
      return res.status(400).json({ error: "Passord må være minst 8 tegn" });
    }

    const lowered = String(email).trim().toLowerCase();
    const repo = AppDataSource.getRepository(Employee);
    // Fetch core fields only
    const user = await repo
      .createQueryBuilder("e")
      .select(["e.id", "e.name", "e.email", "e.password_hash"]) // omit role for compatibility
      .where("LOWER(e.email) = :email", { email: lowered })
      .getRawOne();

    if (!user) {
      return res.status(404).json({ error: "Bruker ikke funnet" });
    }
    const has = Boolean(user.e_password_hash ?? user.password_hash);
    if (has) {
      return res.status(400).json({ error: "Passord er allerede satt" });
    }

    // Oppdater passord-hash uten å laste hele entiteten (unngå kolonner som mangler i eldre skjema)
    const userId = user.e_id ?? user.id;
    const hash = await bcrypt.hash(password, 10);
    await repo.createQueryBuilder()
      .update(Employee)
      .set({ passwordHash: hash })
      .where("id = :id", { id: userId })
      .execute();

    // Build a minimal session payload
    req.session.userId = userId;
    req.session.user = {
      id: userId,
      email: user.e_email ?? user.email ?? lowered,
      name: user.e_name ?? user.name ?? "",
      role: "",
    };

    // Issue JWT so client can access JWT-protected endpoints immediately
    try {
      const u = (req as any).session?.user || { id: req.session.userId, email: (user.e_email ?? user.email ?? lowered), name: (user.e_name ?? user.name ?? ""), role: "" };
      if (!u.role) {
        try { (u as any).role = await fetchUserRole(u.id); } catch {}
      }
      const payload = {
        sub: u.id,
        email: u.email || "",
        name: u.name || "",
        role: u.role || "",
      } as any;
      req.session.save(() => {
        const token = jwt.sign(payload, process.env.JWT_SECRET || (process.env.SECRET_KEY || "dev-secret-change-me"), { expiresIn: "12h" });
        return res.json({ ok: true, token, user: payload });
      });
    } catch {
      return res.json({ ok: true });
    }
  } catch (e) {
    console.error("set_initial_password error:", e);
    return res.status(500).json({ error: "Kunne ikke sette passord" });
  }
});

// GET /api/auth/password_status
// Returnerer om innlogget bruker har passord satt (for å vise enkel UI for førstegangs-innlogging)
router.get("/password_status", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.json({ authenticated: false, set: false, requiresSetup: false });
    }
    const row = await AppDataSource
      .createQueryBuilder()
      .select(["e.id", "e.password_hash"]).from(Employee, "e")
      .where("e.id = :id", { id: req.session.userId })
      .getRawOne();
    const has = Boolean(row?.e_password_hash ?? row?.password_hash);
    return res.json({ authenticated: true, set: has, requiresSetup: !has });
  } catch (e) {
    console.error("password_status error:", e);
    return res.json({ authenticated: false, set: false, requiresSetup: false });
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
    // Prefer full set including role; if it fails (legacy schema), fall back to core columns
    let row: any = null;
    try {
      row = await AppDataSource
        .createQueryBuilder()
        .select(["e.id", "e.name", "e.email", "e.role"]) // may fail on legacy schemas
        .from(Employee, "e")
        .where("e.id = :id", { id: req.session.userId })
        .getRawOne();
    } catch (e) {
      row = await AppDataSource
        .createQueryBuilder()
        .select(["e.id", "e.name", "e.email"]) // compatibility fallback
        .from(Employee, "e")
        .where("e.id = :id", { id: req.session.userId })
        .getRawOne();
    }

    if (!row) {
      return res.json({ authenticated: false });
    }

    res.json({
      authenticated: true,
      user: {
        id: row.e_id ?? row.id,
  email: row.e_email ?? row.email,
  name: row.e_name ?? row.name,
  role: (row as any)?.e_role ?? (row as any)?.role ?? "",
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

// Lightweight auth check for reverse proxy (Nginx auth_request)
// Returns 204 if authenticated (session or bearer), 401 otherwise.
router.get("/check", (req, res) => {
  try {
    if (req?.session?.userId) return res.sendStatus(204);
    const h = req.headers?.authorization || "";
    const t = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!t) return res.sendStatus(401);
    try {
      const jwt = require('jsonwebtoken');
      jwt.verify(t, process.env.JWT_SECRET || (process.env.SECRET_KEY || "dev-secret-change-me"));
      return res.sendStatus(204);
    } catch {
      return res.sendStatus(401);
    }
  } catch {
    return res.sendStatus(401);
  }
});

// GET /api/auth/token — issue a JWT for current session
router.get("/token", (req, res) => {
  try {
    const user = req?.session?.user;
    if (!user || !req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    const doRespond = (roleVal: string) => {
      const payload = { sub: user.id, email: user.email, name: user.name, role: (roleVal || user.role || "") };
      const token = jwt.sign(payload, process.env.JWT_SECRET || (process.env.SECRET_KEY || "dev-secret-change-me"), { expiresIn: "12h" });
      return res.json({ token, user: payload });
    };
    if (!user.role) {
      fetchUserRole(user.id).then(role => doRespond(role)).catch(() => doRespond(""));
    } else {
      return doRespond(user.role);
    }
  } catch (e) {
    return res.status(500).json({ error: "Failed to issue token" });
  }
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

// Require that the request is authenticated (either session or JWT)
export function requireAuthenticated(req: any, res: any, next: any) {
  try {
    // Session-based
    if (req?.session?.userId) return next();
    // Or JWT-based
    const h = req.headers?.authorization || "";
    const t = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!t) return res.status(401).json({ error: "Unauthorized" });
    const decoded = jwt.verify(t, process.env.JWT_SECRET || (process.env.SECRET_KEY || "dev-secret-change-me"));
    (req as any).jwt = decoded;
    return next();
  } catch (_) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

// Require one of the provided roles (e.g., 'admin', 'manager')
export function requireRole(...roles: string[]) {
  return function (req: any, res: any, next: any) {
  const role = (req?.jwt?.role || req?.session?.user?.role || '').toString().toLowerCase();
  const email = (req?.jwt?.email || req?.session?.user?.email || '').toString().toLowerCase();
  // Allowlist fallback for legacy DB without role column
  const allow = (process.env.ADMIN_EMAILS || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  if (roles.includes(role)) return next();
  if (allow.length && email && allow.includes(email)) return next();
  return res.status(403).json({ error: "Forbidden" });
  };
}

// Common helper for admin-level access (admin or manager)
export const requireAdmin = () => requireRole("admin", "manager");
