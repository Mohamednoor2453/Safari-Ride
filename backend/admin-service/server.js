// admin-service/server.js

const express = require('express');
const { connectDB, isDBReady } = require("../shared/db"); // Changed: destructure from object
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo').default;
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const session = require('express-session');

const app = express();

// CORS configuration
app.use(cors({
  origin: ['http://localhost:8081', 'http://192.168.1.112:8081', 'http://192.168.1.112:19006'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Content-Disposition']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ========================
   MONGOOSE SAFETY SETTINGS
   ======================== */
mongoose.set("bufferCommands", false); // ❗ prevent silent buffering
mongoose.set("strictQuery", true);
mongoose.set('autoIndex', false);

// Logging middleware
app.use((req, res, next) => {
  console.log(`🌐 ${req.method} ${req.url} - ${new Date().toISOString()}`);
  next();
});

/* ========================
   START SERVER WITH DB CONNECTION
   ======================== */
const PORT = process.env.PORT || 3006;

async function startServer() {
  try {
    console.log("=".repeat(50));
    console.log("🚀 Starting Admin Service...");
    console.log("=".repeat(50));
    
    console.log("🔗 Step 1: Connecting to MongoDB...");
    
    // ✅ CONNECT TO DB FIRST (same as payment service)
    let dbConnection;
    try {
      dbConnection = await connectDB();
      console.log(`✅ MongoDB connection initiated`);
    } catch (connectError) {
      console.error("❌ MongoDB connection failed:", connectError.message);
      // Continue without DB - some features might not work
    }

    // ✅ SIMPLE CONNECTION CHECK
    console.log("⏳ Checking database connection state...");
    
    // Quick check - if not connected after 3 seconds, proceed anyway
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const dbReady = isDBReady();
    
    if (!dbReady) {
      console.warn("⚠️ Database not fully ready - starting service anyway");
      console.warn(`⚠️ Current DB state: ${getStateText(mongoose.connection.readyState)}`);
    } else {
      console.log(`✅ Database connected and ready: ${mongoose.connection.name || 'Unknown'}`);
      console.log(`📊 DB Host: ${mongoose.connection.host || 'Unknown'}`);
    }

    // SESSION setup (after DB connection attempt)
    app.use(
      session({
        secret: process.env.SESSION_SECRET_KEY || 'your-secret-key-here',
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
          mongoUrl: process.env.dbURL,
          collectionName: "sessions"
        }),
        cookie: {
          secure: false,
          httpOnly: true,
          maxAge: 1000 * 60 * 60 * 24 * 7,
        }
      })
    );

    // Import routes
    const manageDriversRoutes = require('./Routes/manageDrivers.js');
    const managePaymentRoutes = require('./Routes/managePyaments.js');

    // Use routes
    app.use('/api/admin/drivers', manageDriversRoutes);
    app.use('/api/admin/payment', managePaymentRoutes);

    // Test route
    app.get('/api/admin/test', (req, res) => {
      res.json({ 
        success: true, 
        message: 'Admin API is working',
        database: isDBReady() ? 'connected' : 'disconnected'
      });
    });

    // Health check route with DB status
    app.get('/', (req, res) => {
      const state = mongoose.connection.readyState;
      
      res.json({ 
        success: true, 
        service: 'Safari Ride Admin Service',
        database: state === 1 ? 'connected' : 'disconnected',
        dbState: state,
        dbStateText: getStateText(state),
        timestamp: new Date().toISOString(),
        endpoints: {
          test: '/api/admin/test',
          unverifiedDrivers: '/api/admin/drivers/unverified',
          verifiedDrivers: '/api/admin/drivers/verified',
          verifyDriver: '/api/admin/drivers/verify (POST)',
          deleteDriver: '/api/admin/drivers/delete (POST)',
          toggleStatus: '/api/admin/drivers/toggle-status (POST)',
          payments: '/api/admin/payment'
        }
      });
    });

    // Database health endpoint (similar to payment service)
    app.get('/db-health', async (req, res) => {
      try {
        const state = mongoose.connection.readyState;
        let dbInfo = {};
        
        if (state === 1) {
          try {
            const collections = await mongoose.connection.db.listCollections().toArray();
            dbInfo = {
              name: mongoose.connection.name,
              host: mongoose.connection.host,
              port: mongoose.connection.port,
              collections: collections.map(c => c.name)
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
       ERROR HANDLING
       ======================== */
    app.use((err, req, res, next) => {
      console.error("❌ Server error:", err.message);
      console.error(err.stack);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" ? err.message : "Please try again later"
      });
    });

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: "Route not found",
        path: req.path,
        method: req.method
      });
    });

    // ✅ Start listening
    console.log("=".repeat(50));
    console.log(`👨‍💼 Admin Service running on port ${PORT}`);
    console.log(`🗄️  Database: ${isDBReady() ? 'CONNECTED' : 'DISCONNECTED'} (${mongoose.connection.name || 'N/A'})`);
    console.log(`📊 DB State: ${getStateText(mongoose.connection.readyState)}`);
    console.log(`🕐 Time: ${new Date().toISOString()}`);
    console.log("=".repeat(50));
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server listening on http://localhost:${PORT}`);
      console.log(`✅ Health check: http://localhost:${PORT}/db-health`);
      console.log(`✅ Admin routes: http://localhost:${PORT}/api/admin`);
      console.log(`🚗 Driver management: http://localhost:${PORT}/api/admin/drivers`);
      console.log(`🏠 Home page: http://localhost:${PORT}/`);
    });

  } catch (err) {
    console.error("❌ Fatal startup error:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

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

/* ========================
   GRACEFUL SHUTDOWN
   ======================== */
process.on("SIGINT", async () => {
  console.log("\n" + "=".repeat(50));
  console.log("🛑 Shutting down Admin Service gracefully...");
  console.log("=".repeat(50));
  
  if (mongoose.connection.readyState === 1) {
    try {
      await mongoose.connection.close();
      console.log("🧹 MongoDB connection closed");
    } catch (err) {
      console.error("❌ Error closing MongoDB connection:", err.message);
    }
  }
  
  console.log("👋 Admin Service shutdown complete");
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

// Start the server
startServer();

module.exports = app;