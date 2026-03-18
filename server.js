// server.js or app.js

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const db = require("./config/db");

// 🔹 Routes
const studentRoutes = require("./routes/studentRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();

/* ==========================
   🔥 CORS FIX (IMPORTANT)
========================== */

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://admisiondemo.netlify.app" // ✅ FIXED: Removed trailing slash
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, Postman, curl)
      if (!origin) {
        console.log("✅ Request with no origin allowed");
        return callback(null, true);
      }

      // Check if the origin is allowed
      if (allowedOrigins.includes(origin)) {
        console.log(`✅ Origin allowed: ${origin}`);
        return callback(null, true);
      } else {
        console.log(`❌ Origin blocked by CORS: ${origin}`);
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true, // Allow cookies and authentication headers
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    optionsSuccessStatus: 200 // Some legacy browsers choke on 204
  })
);

// Handle preflight OPTIONS requests explicitly
app.options("*", cors());

/* ==========================
   🔹 MIDDLEWARE
========================== */

// Logger
app.use(morgan("dev"));

// Body Parser
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request Logger for debugging
app.use((req, res, next) => {
  console.log("=".repeat(50));
  console.log(`📥 ${req.method} ${req.url}`);
  console.log(`🌐 Origin: ${req.headers.origin || "No Origin"}`);
  console.log(`🔑 Auth Header: ${req.headers.authorization ? "Present" : "Not Present"}`);
  console.log("=".repeat(50));
  next();
});

/* ==========================
   🔹 ROUTES
========================== */

// Test route (no auth required)
app.get("/api/test", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is working 🚀",
    time: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development"
  });
});

// Auth routes
app.use("/api/auth", authRoutes);

// Student routes
app.use("/api/students", studentRoutes);

// Home route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend Server Running 🚀",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    endpoints: {
      home: "GET /",
      health: "GET /health",
      test: "GET /api/test",
      auth: {
        login: "POST /api/auth/login",
        register: "POST /api/auth/register",
        logout: "POST /api/auth/logout"
      },
      students: {
        getAll: "GET /api/students",
        getOne: "GET /api/students/:id",
        create: "POST /api/students",
        update: "PUT /api/students/:id",
        delete: "DELETE /api/students/:id"
      }
    },
    cors_allowed_origins: allowedOrigins
  });
});

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy ✅",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: db ? "Connected" : "Disconnected"
  });
});

/* ==========================
   🔹 404 Handler - Route Not Found
========================== */

app.use("*", (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    available_routes: {
      get: ["/", "/health", "/api/test", "/api/auth/*", "/api/students/*"],
      post: ["/api/auth/login", "/api/auth/register", "/api/students"],
      put: ["/api/students/:id"],
      delete: ["/api/students/:id"]
    }
  });
});

/* ==========================
   🔹 Global Error Handler
========================== */

app.use((err, req, res, next) => {
  console.error("❌ Error:", err);
  
  // Handle specific error types
  if (err.message.includes("CORS")) {
    return res.status(403).json({
      success: false,
      message: "CORS error: Origin not allowed",
      error: err.message
    });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation Error",
      errors: err.errors
    });
  }

  if (err.name === "UnauthorizedError") {
    return res.status(401).json({
      success: false,
      message: "Unauthorized access"
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err.stack : undefined
  });
});

/* ==========================
   🔹 START SERVER
========================== */

const startServer = async () => {
  try {
    // Test database connection
    const conn = await db.getConnection();
    console.log("✅ Database connected successfully");
    conn.release();

    const PORT = process.env.PORT || 5000;
    const HOST = "0.0.0.0"; // Listen on all network interfaces

    const server = app.listen(PORT, HOST, () => {
      console.log("\n" + "=".repeat(60));
      console.log(`🚀 Server started successfully!`);
      console.log("=".repeat(60));
      console.log(`📡 Server URL: http://${HOST}:${PORT}`);
      console.log(`🌍 Public URL: ${process.env.RENDER_URL || "https://your-backend.onrender.com"}`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`📝 CORS Allowed Origins:`);
      allowedOrigins.forEach(origin => console.log(`   - ${origin}`));
      console.log("=".repeat(60) + "\n");
    });

    // Handle server errors
    server.on("error", (error) => {
      console.error("❌ Server error:", error);
    });

  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err);
  process.exit(1);
});

// Start the server
startServer();