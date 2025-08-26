import "reflect-metadata";
import express from "express";
import cors from "cors";
import session from "express-session";
import { AppDataSource } from "./data-source";

const app = express();
const PORT = process.env.PORT || 8001;

// Middleware
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ],
  credentials: true,
}));

app.use(express.json());

// Session configuration
app.use(session({
  secret: process.env.SECRET_KEY || "dev-secret-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// Basic test route
app.get("/", (req, res) => {
  res.json({ 
    message: "BSK Service Node.js Backend - Test Version",
    status: "running",
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", database: "not tested yet" });
});

// Auth test route
app.post("/api/auth/login", (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }
  
  // Mock authentication for testing
  (req.session as any).user = { email, role: "admin" };
  res.json({ message: "Login successful", email, role: "admin" });
});

app.get("/api/auth/whoami", (req, res) => {
  const user = (req.session as any).user;
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  res.json(user);
});

// Start server
async function startServer() {
  try {
    console.log("Starting test server...");
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    
    // Skip database initialization for now
    console.log("Skipping database connection for basic test");

    app.listen(PORT, () => {
      console.log(`✅ Test server running on port ${PORT}`);
      console.log(`📡 Health check: http://localhost:${PORT}/health`);
      console.log(`🔐 Test login: POST http://localhost:${PORT}/api/auth/login`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
