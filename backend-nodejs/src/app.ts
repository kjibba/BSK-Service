import "reflect-metadata";
import express from "express";
import cors from "cors";
import session from "express-session";
import fileUpload from "express-fileupload";
import path from "path";
import { AppDataSource } from "./data-source";

// Import routes
// @ts-ignore: route modules may be JS-built or generated at runtime
import authRoutes from "./routes/auth";
import { requireAuthenticated } from "./routes/auth";
// @ts-ignore: route modules may be JS-built or generated at runtime
import customerRoutes from "./routes/customers";
// @ts-ignore: route modules may be JS-built or generated at runtime
import visitRoutes, { officeVisitsRouter } from "./routes/visits";
// @ts-ignore: route modules may be JS-built or generated at runtime
import equipmentRoutes from "./routes/equipment";
// @ts-ignore: route modules may be JS-built or generated at runtime
import equipmentTypeRoutes from "./routes/equipmentTypes";
// @ts-ignore: route modules may be JS-built or generated at runtime
import serviceLogRoutes from "./routes/serviceLogs";
// @ts-ignore: route modules may be JS-built or generated at runtime
import materialRoutes from "./routes/materials";
// @ts-ignore: route modules may be JS-built or generated at runtime
import feedbackRoutes from "./routes/feedback";
// @ts-ignore: route modules may be JS-built or generated at runtime
import employeeRoutes from "./routes/employees";
// @ts-ignore: route modules may be JS-built or generated at runtime
import metaRoutes from "./routes/meta";
// @ts-ignore: route modules may be JS-built or generated at runtime
import routeChoicesRoutes from "./routes/routeChoices";
// @ts-ignore: route modules may be JS-built or generated at runtime
import reportsRoutes from "./routes/serviceReports";

const app = express();
const PORT = process.env.PORT || 8000;
const NODE_ENV = process.env.NODE_ENV || "development";
const COOKIE_SECURE = String(process.env.COOKIE_SECURE ?? (NODE_ENV === "production" ? "false" : "false")).toLowerCase() === "true";
const COOKIE_NAME = process.env.SESSION_NAME || 'connect.sid';
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;

// Behind nginx/proxy in docker: trust proxy so cookies and protocol are detected correctly
app.set("trust proxy", 1);

// Minimal health endpoint registered BEFORE middleware so it can't be blocked by them
app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Middleware
// CORS: i dev tillates alle origins; i prod tillates kun kjente/domene-configurerte origins
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // same-origin eller server-til-server
    if (NODE_ENV !== "production") return callback(null, true);
    // Prod: tillat eksplisitt oppgitte origins
    const envList = (process.env.APP_ORIGINS || "https://bsk.kjibba.no").split(",").map(s => s.trim()).filter(Boolean);
    // Tillat localhost-opprinnelser for lokal kjøring via nginx-proxy
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  // Tillat privat LAN-opprinnelser (for mobil på samme nett) når man kjører lokalt via nginx (5175)
  const isPrivateLan = /^https?:\/\/(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(origin);
  if (envList.includes(origin) || isLocal || isPrivateLan) return callback(null, true);
    return callback(new Error("CORS not allowed"));
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SECRET_KEY || "dev-secret-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: {
  // Bruk Secure-cookie kun dersom eksplisitt slått på via env i miljø med HTTPS
  secure: COOKIE_SECURE,
  sameSite: "lax",
  // Sett domain dersom spesifisert (trengs for noen proxyscenarier)
  domain: COOKIE_DOMAIN as any,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
  name: COOKIE_NAME,
}));

// File upload middleware
app.use(fileUpload({
  createParentPath: true,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
}));

// Serve static files (uploads)
app.use("/static", express.static(path.join(__dirname, "../static")));

// Routes
app.get("/", (req, res) => {
  res.json({ message: "Hello, BSK Service App!" });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
// Global guard: require authentication for all /api routes except /api/auth and health endpoints.
app.use("/api", (req, res, next) => {
  try {
    const p = req.path || "";
    // allow auth routes and health checks
    if (p === "/health" || p === "/healthz") return next();
    if (p.startsWith("/auth")) return next();
  // allow client error logging without auth only for POST (so we can capture pre-login issues)
  if (p === "/meta/client-log" && req.method === 'POST') return next();
    // Delegate to requireAuthenticated which handles session or JWT
    return requireAuthenticated(req, res, next);
  } catch (e) {
    return res.status(401).json({ error: "Unauthorized" });
  }
});
app.use("/api/customers", customerRoutes);
app.use("/api/map", customerRoutes); // map routes are in customers
app.use("/api/visits", visitRoutes);
app.use("/api/office/visits", officeVisitsRouter); // separate router to avoid conflicts
app.use("/api/equipment", equipmentRoutes);
app.use("/api/equipment-types", equipmentTypeRoutes);
app.use("/api/service-logs", serviceLogRoutes);
app.use("/api/materials", materialRoutes);
app.use("/api/meta", metaRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/route-choices", routeChoicesRoutes);
app.use("/api/reports", reportsRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Always log server-side
  console.error("Error:", err);
  if (NODE_ENV === "development") {
    // Surface details in dev to speed up debugging
    res.status(500).json({
      error: "Internal server error",
      message: err?.message,
      stack: err?.stack,
      path: req.path,
    });
  } else {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Global process-level error logging (dev aid)
process.on("unhandledRejection", (reason) => {
  console.error("UnhandledRejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("UncaughtException:", err);
});

// Initialize database and start server
async function startServer() {
  try {
    await AppDataSource.initialize();
    console.log("Database connection established");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${NODE_ENV}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
