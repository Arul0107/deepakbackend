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
  "https://admisiondemo.netlify.app/" // 🔥 CHANGE THIS
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like Postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        console.log("❌ Blocked by CORS:", origin);
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

/* ==========================
   🔹 MIDDLEWARE
========================== */

// Logger
app.use(morgan("dev"));

// Body Parser
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Debug logger
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url} from ${req.headers.origin || "unknown"}`);
  next();
});

/* ==========================
   🔹 ROUTES
========================== */

// Auth
app.use("/api/auth", authRoutes);

// Students
app.use("/api/students", studentRoutes);

// Test route
app.get("/api/test", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API working 🚀",
    time: new Date().toISOString()
  });
});

// Home route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Backend Running 🚀",
    endpoints: {
      auth: "/api/auth",
      students: "/api/students",
      test: "/api/test"
    }
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Server healthy",
    timestamp: new Date().toISOString()
  });
});

/* ==========================
   🔹 404
========================== */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.url}`
  });
});

/* ==========================
   🔹 ERROR HANDLER
========================== */

app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);

  res.status(500).json({
    success: false,
    message: err.message || "Internal Server Error"
  });
});

/* ==========================
   🔹 START SERVER
========================== */

const startServer = async () => {
  try {
    const conn = await db.getConnection();
    console.log("✅ DB Connected");
    conn.release();

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, "0.0.0.0", () => {
      console.log("=".repeat(40));
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Render URL: https://your-backend.onrender.com`);
      console.log("=".repeat(40));
    });

  } catch (err) {
    console.error("❌ DB Failed:", err);
    process.exit(1);
  }
};

startServer();