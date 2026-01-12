// server.js

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");

const { connectDB, isDBReady } = require("../shared/db");
const paymentRoutes = require("./routes/payment");

const app = express();

/* ========================
   MONGOOSE SAFETY SETTINGS
   ======================== */
mongoose.set("bufferCommands", false); // ❗ prevent silent buffering
mongoose.set("strictQuery", true);

// Remove duplicate index warnings by disabling schema index creation
mongoose.set('autoIndex', false);

/* ========================
   MIDDLEWARE
   ======================== */
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`🌐 ${req.method} ${req.url} - ${new Date().toISOString()}`);
  next();
});

/* ========================
   ROOT / HEALTH CHECK
   ======================== */
app.get("/", (req, res) => {
  const state = mongoose.connection.readyState;

  res.json({
    service: "Safari Ride Payment Service",
    status: "running",
    database: state === 1 ? "connected" : "disconnected",
    dbState: state,
    dbStateText: getStateText(state),
    timestamp: new Date().toISOString(),
    endpoints: {
      mpesa: "POST /api/payments/mpesa",
      cash: "POST /api/payments/cash",
      status: "GET /api/payments/status",
      simulate: "POST /api/payments/simulate",
      health: "GET /api/payments/health"
    }
  });
});

// Helper function to get connection state text
const getStateText = (state) => {
  switch (state) {
    case 0: return "disconnected";
    case 1: return "connected";
    case 2: return "connecting";
    case 3: return "disconnecting";
    default: return "unknown";
  }
};

// Database health endpoint
app.get("/db-health", async (req, res) => {
  try {
    const state = mongoose.connection.readyState;
    let dbInfo = {};
    
    if (state === 1) {
      try {
        dbInfo = {
          name: mongoose.connection.name,
          host: mongoose.connection.host,
          port: mongoose.connection.port,
          collections: await mongoose.connection.db.listCollections().toArray()
        };
      } catch (err) {
        dbInfo = { error: err.message };
      }
    }
    
    res.json({
      status: state === 1 ? "connected" : "disconnected",
      state: state,
      stateText: getStateText(state),
      readyState: state,
      isDBReady: isDBReady(),
      info: dbInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error.message,
      state: mongoose.connection.readyState,
      stateText: getStateText(mongoose.connection.readyState)
    });
  }
});

/* ========================
   START SERVER
   ======================== */
const PORT = process.env.PORT || 3007;

async function startServer() {
  try {
    console.log("=".repeat(50));
    console.log("🚀 Starting Payment Service...");
    console.log("=".repeat(50));
    
    console.log("🔗 Step 1: Connecting to MongoDB...");
    
    // ✅ CONNECT TO DB FIRST (CRITICAL FIX)
    let dbConnection;
    try {
      dbConnection = await connectDB();
      console.log(`✅ MongoDB connection initiated`);
    } catch (connectError) {
      console.error("❌ MongoDB connection failed:", connectError.message);
      // Continue without DB - use memory storage
    }

    // ✅ SIMPLE CONNECTION CHECK - Don't wait indefinitely
    console.log("⏳ Checking database connection state...");
    
    // Quick check - if not connected after 3 seconds, proceed anyway
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const dbReady = isDBReady();
    
    if (!dbReady) {
      console.warn("⚠️ Database not fully ready - starting with memory storage");
      console.warn("⚠️ Payments will be stored in memory until DB connects");
      console.warn(`⚠️ Current DB state: ${getStateText(mongoose.connection.readyState)}`);
    } else {
      console.log(`✅ Database connected and ready: ${mongoose.connection.name || 'Unknown'}`);
      console.log(`📊 DB Host: ${mongoose.connection.host || 'Unknown'}`);
    }

    // ✅ Load models AFTER DB connection attempt
    console.log("📦 Step 2: Loading database models...");
    try {
      require("./models/Payment");
      console.log("✅ Models loaded");
    } catch (modelError) {
      console.error("❌ Model loading error:", modelError.message);
      console.warn("⚠️ Continuing without models - using direct MongoDB operations");
    }
    
    // Start memory sync interval (every 30 seconds) if function exists
    console.log("🔄 Step 3: Setting up background sync...");
    if (global.syncMemoryPaymentsToDB && typeof global.syncMemoryPaymentsToDB === 'function') {
      setInterval(() => {
        if (isDBReady()) {
          global.syncMemoryPaymentsToDB();
        }
      }, 30000);
      console.log("✅ Background sync configured (30s interval)");
    } else {
      console.warn("⚠️ Background sync function not available");
    }

    // ✅ Mount routes (always mount them, they handle DB fallback)
    console.log("🛣️  Step 4: Mounting routes...");
    app.use("/api/payments", paymentRoutes);
    console.log("✅ Routes mounted");

    /* ========================
       ERROR HANDLING
       ======================== */
    app.use((err, req, res, next) => {
      console.error("❌ Server error:", err.message);
      console.error(err.stack);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        details:
          process.env.NODE_ENV === "development"
            ? err.message
            : "Please try again later"
      });
    });

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: "Endpoint not found",
        path: req.path
      });
    });

    // ✅ Start listening
    console.log("=".repeat(50));
    console.log(`💳 Payment Service running on port ${PORT}`);
    console.log(`🗄️  Database: ${isDBReady() ? 'CONNECTED' : 'DISCONNECTED'} (${mongoose.connection.name || 'N/A'})`);
    console.log(`📊 DB State: ${getStateText(mongoose.connection.readyState)}`);
    console.log(`🕐 Time: ${new Date().toISOString()}`);
    console.log("=".repeat(50));
    
    app.listen(PORT, () => {
      console.log(`✅ Server listening on http://localhost:${PORT}`);
      console.log(`✅ Health check: http://localhost:${PORT}/db-health`);
      console.log(`✅ Payment endpoint: http://localhost:${PORT}/api/payments/mpesa`);
    });

  } catch (err) {
    console.error("❌ Fatal startup error:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

startServer();

/* ========================
   GRACEFUL SHUTDOWN
   ======================== */
process.on("SIGINT", async () => {
  console.log("\n" + "=".repeat(50));
  console.log("🛑 Shutting down Payment Service gracefully...");
  console.log("=".repeat(50));
  
  if (mongoose.connection.readyState === 1) {
    try {
      await mongoose.connection.close();
      console.log("🧹 MongoDB connection closed");
    } catch (err) {
      console.error("❌ Error closing MongoDB connection:", err.message);
    }
  }
  
  // Log memory payments count
  if (global.inMemoryPayments) {
    console.log(`💾 Memory payments count: ${global.inMemoryPayments.length}`);
  }
  
  console.log("👋 Payment Service shutdown complete");
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = app;