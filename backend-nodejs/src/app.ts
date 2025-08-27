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

// Minimal health endpoint registered BEFORE middleware so it can't be blocked by them
app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Middleware
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
  "http://localhost:5176",
  "http://127.0.0.1:5176",
  ],
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
    secure: NODE_ENV === "production",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
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
