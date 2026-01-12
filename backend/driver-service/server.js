// driver-service/server.js

const express = require('express');
const { connectDB, isDBReady } = require("../shared/db"); // Fixed import
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const session = require('express-session');

const app = express();

/* ========================
   MONGOOSE SAFETY SETTINGS
   ======================== */
mongoose.set("bufferCommands", false);
mongoose.set("strictQuery", true);
mongoose.set('autoIndex', false);

// CORS middleware
app.use(cors({
  origin: ['http://localhost:8081', 'http://192.168.1.112:8081'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Content-Disposition']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`🌐 ${req.method} ${req.url} - ${new Date().toISOString()}`);
  next();
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

/* ========================
   START SERVER
   ======================== */
const PORT = process.env.PORT || 3004;

async function startServer() {
  try {
    console.log("=".repeat(50));
    console.log("🚀 Starting Driver Service...");
    console.log("=".repeat(50));
    
    console.log("🔗 Step 1: Connecting to MongoDB...");
    
    // ✅ CONNECT TO DB FIRST
    let dbConnection;
    try {
      dbConnection = await connectDB();
      console.log(`✅ MongoDB connection initiated`);
    } catch (connectError) {
      console.error("❌ MongoDB connection failed:", connectError.message);
    }

    // ✅ SIMPLE CONNECTION CHECK
    console.log("⏳ Checking database connection state...");
    
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
        secret: process.env.SESSION_SECRET_KEY || 'driver-secret-key',
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
          mongoUrl: process.env.dbURL,
          collectionName: "driver_sessions"
        }),
        cookie: {
          secure: false,
          httpOnly: true,
          maxAge: 1000 * 60 * 60 * 24 * 7,
        }
      })
    );

    /* ========================
       LOAD AND VALIDATE ROUTES
       ======================== */
    console.log("🛣️  Step 2: Loading routes...");
    
    // Define a safe route loader function
    const loadRoute = (routePath, routeName) => {
      try {
        const route = require(routePath);
        
        if (typeof route === 'function') {
          console.log(`✅ ${routeName} route loaded successfully`);
          return route;
        } else if (route && typeof route === 'object' && typeof route.router === 'function') {
          console.log(`✅ ${routeName} router loaded successfully`);
          return route.router || route;
        } else {
          console.error(`❌ ${routeName} is not a valid route handler`);
          console.log(`⚠️ Creating dummy route for ${routeName}...`);
          
          // Create a dummy router that shows an error message
          const dummyRouter = express.Router();
          dummyRouter.all('*', (req, res) => {
            res.status(503).json({
              success: false,
              error: 'Route temporarily unavailable',
              message: `${routeName} route is not properly configured`,
              path: req.path
            });
          });
          return dummyRouter;
        }
      } catch (error) {
        console.error(`❌ Failed to load ${routeName}:`, error.message);
        console.log(`⚠️ Creating fallback route for ${routeName}...`);
        
        // Create a fallback router
        const fallbackRouter = express.Router();
        fallbackRouter.all('*', (req, res) => {
          res.status(503).json({
            success: false,
            error: 'Service temporarily unavailable',
            message: `${routeName} is not available: ${error.message}`,
            path: req.path
          });
        });
        return fallbackRouter;
      }
    };

    // Load routes safely
    const driverAuthRoutes = loadRoute('./Routes/auth.js', 'Driver Authentication');
    const driverProfileRoutes = loadRoute('./Routes/driverProfile.js', 'Driver Profile');

    // Use routes
    app.use('/api', driverAuthRoutes);
    app.use('/api', driverProfileRoutes);
    console.log("✅ All routes mounted");

    /* ========================
       HEALTH & TEST ROUTES
       ======================== */
    
    // Root endpoint
    app.get('/', (req, res) => {
      const state = mongoose.connection.readyState;
      
      res.json({ 
        success: true, 
        service: 'Safari Ride Driver Service',
        status: 'running',
        database: state === 1 ? 'connected' : 'disconnected',
        dbState: state,
        dbStateText: getStateText(state),
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/api/health',
          test: '/api/test',
          register: '/api/register',
          login: '/api/login',
          profile: '/api/driver-profile',
          dbHealth: '/db-health'
        }
      });
    });

    // Database health endpoint
    app.get('/db-health', async (req, res) => {
      try {
        const state = mongoose.connection.readyState;
        
        res.json({
          status: state === 1 ? "connected" : "disconnected",
          state: state,
          stateText: getStateText(state),
          readyState: state,
          isDBReady: isDBReady(),
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          status: "error",
          error: error.message,
          state: mongoose.connection.readyState
        });
      }
    });

    // Health check
    app.get('/api/health', (req, res) => {
      const state = mongoose.connection.readyState;
      
      res.json({ 
        success: true, 
        message: 'Driver Service is running',
        port: process.env.PORT || 3004,
        database: state === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
      });
    });

    // Test endpoint
    app.get('/api/test', (req, res) => {
      res.json({ 
        success: true, 
        message: 'Driver API is working',
        database: isDBReady() ? 'connected' : 'disconnected'
      });
    });

    /* ========================
       ERROR HANDLING
       ======================== */
    app.use((err, req, res, next) => {
      console.error("❌ Server error:", err.message);
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
        error: 'Route not found',
        endpoint: req.originalUrl,
        method: req.method
      });
    });

    // ✅ Start listening
    console.log("=".repeat(50));
    console.log(`🚗 Driver Service running on port ${PORT}`);
    console.log(`🗄️  Database: ${isDBReady() ? 'CONNECTED' : 'DISCONNECTED'}`);
    console.log(`📊 DB State: ${getStateText(mongoose.connection.readyState)}`);
    console.log(`🕐 Time: ${new Date().toISOString()}`);
    console.log("=".repeat(50));
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server listening on http://localhost:${PORT}`);
      console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
      console.log(`✅ Test endpoint: http://localhost:${PORT}/api/test`);
      console.log(`📱 Registration: http://localhost:${PORT}/api/register`);
      console.log(`🔐 Login: http://localhost:${PORT}/api/login`);
      console.log(`🏠 Home: http://localhost:${PORT}/`);
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
  console.log("🛑 Shutting down Driver Service gracefully...");
  console.log("=".repeat(50));
  
  if (mongoose.connection.readyState === 1) {
    try {
      await mongoose.connection.close();
      console.log("🧹 MongoDB connection closed");
    } catch (err) {
      console.error("❌ Error closing MongoDB connection:", err.message);
    }
  }
  
  console.log("👋 Driver Service shutdown complete");
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
});

module.exports = app;