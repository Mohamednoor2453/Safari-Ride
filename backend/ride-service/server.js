// backend/ride-service/server.js
const express = require('express');
const { connectDB, isDBReady } = require("../shared/db"); // Fixed import
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const path = require('path');
const cors = require('cors'); // Add CORS
require('dotenv').config();

const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');

const app = express();

/* ========================
   MONGOOSE SAFETY SETTINGS
   ======================== */
mongoose.set("bufferCommands", false);
mongoose.set("strictQuery", true);
mongoose.set('autoIndex', false);

// CORS configuration
app.use(cors({
  origin: '*', // You can specify specific origins like other services
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
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
   SOCKET.IO SETUP
   ======================== */
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Import models
const Driver = require("../shared/models/Driver");
const RideDetails = require("../shared/models/RideDetails");

// Enhanced in-memory storage
const driverSockets = new Map(); // driverId -> socket
const socketToDriver = new Map(); // socketId -> driverId
const userSockets = new Map(); // userId/rideId -> socket
const socketToUser = new Map(); // socketId -> userId/rideId

// Store pending driver responses
const pendingResponses = new Map(); // rideId -> { resolve, reject, timeoutId }

// Store pending notifications for offline users
const pendingUserNotifications = new Map(); // rideId -> notifications array
const pendingDriverNotifications = new Map(); // driverId -> notifications array

// Debug function to log connected drivers
const logConnectedDrivers = () => {
  console.log('=== CONNECTED DRIVERS ===');
  const drivers = Array.from(driverSockets.keys());
  console.log('Total:', drivers.length);
  drivers.forEach(driverId => {
    console.log(`- ${driverId}`);
  });
  console.log('=========================');
};

// Helper to wait for driver response with timeout
const waitForDriverResponse = (rideId, driverId, timeoutMs = 25000) => {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (pendingResponses.has(rideId)) {
        pendingResponses.delete(rideId);
        reject(new Error(`Driver ${driverId} timed out`));
      }
    }, timeoutMs);

    pendingResponses.set(rideId, { resolve, reject, timeoutId });
  });
};

// Helper to send notification to user (stores if offline)
const sendUserNotification = (rideId, notification) => {
  const userSocket = userSockets.get(rideId);
  
  if (userSocket) {
    userSocket.emit('notification', notification);
  } else {
    if (!pendingUserNotifications.has(rideId)) {
      pendingUserNotifications.set(rideId, []);
    }
    pendingUserNotifications.get(rideId).push({
      ...notification,
      timestamp: new Date(),
      read: false
    });
    console.log(`📱 Notification stored for offline user (ride: ${rideId}): ${notification.type}`);
  }
};

// Helper to send notification to driver (stores if offline)
const sendDriverNotification = (driverId, notification) => {
  const driverSocket = driverSockets.get(driverId);
  
  if (driverSocket) {
    driverSocket.emit('notification', notification);
  } else {
    if (!pendingDriverNotifications.has(driverId)) {
      pendingDriverNotifications.set(driverId, []);
    }
    pendingDriverNotifications.get(driverId).push({
      ...notification,
      timestamp: new Date(),
      read: false
    });
    console.log(`📱 Notification stored for offline driver (${driverId}): ${notification.type}`);
  }
};

// Cancel ride helper
const cancelRide = async (rideId, reason = 'user_cancelled') => {
  try {
    const ride = await RideDetails.findById(rideId);
    if (!ride) {
      console.log(`❌ Ride ${rideId} not found for cancellation`);
      return false;
    }

    ride.status = 'cancelled';
    ride.cancellationReason = reason;
    ride.cancelledAt = new Date();
    await ride.save();

    if (ride.assignedDriver) {
      const driverId = ride.assignedDriver.toString();
      const driverSocket = driverSockets.get(driverId);
      
      if (driverSocket) {
        driverSocket.emit('ride_cancelled', {
          rideId,
          reason,
          message: 'Ride has been cancelled by the user',
          timestamp: new Date()
        });
        
        sendDriverNotification(driverId, {
          type: 'ride_cancelled',
          rideId,
          message: 'Ride has been cancelled by the user',
          timestamp: new Date()
        });
        
        console.log(`📢 Notified driver ${driverId} about ride cancellation`);
      }
      
      await Driver.findByIdAndUpdate(driverId, {
        available: true,
        online: true
      });
    }

    const userSocket = userSockets.get(rideId);
    if (userSocket) {
      userSocket.emit('ride_cancelled_user', {
        rideId,
        message: 'Your ride has been cancelled',
        timestamp: new Date()
      });
    }

    if (pendingResponses.has(rideId)) {
      const { timeoutId } = pendingResponses.get(rideId);
      clearTimeout(timeoutId);
      pendingResponses.delete(rideId);
    }

    userSockets.delete(rideId);
    const socketId = Array.from(socketToUser.entries())
      .find(([sid, rid]) => rid === rideId)?.[0];
    if (socketId) {
      socketToUser.delete(socketId);
    }

    console.log(`✅ Ride ${rideId} cancelled successfully`);
    return true;
  } catch (error) {
    console.error('Error cancelling ride:', error);
    return false;
  }
};

// Start ride helper
const startRide = async (rideId, driverId) => {
  try {
    const ride = await RideDetails.findById(rideId);
    if (!ride) {
      console.log(`Ride ${rideId} not found`);
      return false;
    }

    ride.status = 'in_progress';
    ride.startedAt = new Date();
    await ride.save();

    await Driver.findByIdAndUpdate(driverId, {
      available: false
    });

    const userSocket = userSockets.get(rideId);
    if (userSocket) {
      userSocket.emit('ride_started', {
        rideId,
        message: 'Your ride has started',
        startedAt: ride.startedAt,
        timestamp: new Date()
      });
    }

    console.log(`✅ Ride ${rideId} started by driver ${driverId}`);
    return true;
  } catch (error) {
    console.error('❌ Error starting ride:', error);
    return false;
  }
};

// End ride helper
const endRide = async (rideId, driverId) => {
  try {
    const ride = await RideDetails.findById(rideId);
    if (!ride) {
      console.log(`❌ Ride ${rideId} not found`);
      return false;
    }

    ride.status = 'completed';
    ride.completedAt = new Date();
    await ride.save();

    await Driver.findByIdAndUpdate(driverId, {
      available: true,
      online: true
    });

    const userSocket = userSockets.get(rideId);
    if (userSocket) {
      userSocket.emit('ride_completed', {
        rideId,
        message: 'Your ride has been completed',
        completedAt: ride.completedAt,
        fare: ride.fare,
        timestamp: new Date()
      });
    }

    userSockets.delete(rideId);
    const socketId = Array.from(socketToUser.entries())
      .find(([sid, rid]) => rid === rideId)?.[0];
    if (socketId) {
      socketToUser.delete(socketId);
    }

    console.log(`✅ Ride ${rideId} completed by driver ${driverId}`);
    return true;
  } catch (error) {
    console.error('❌ Error ending ride:', error);
    return false;
  }
};

/* ========================
   SOCKET.IO EVENT HANDLERS
   ======================== */
io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);

  socket.on('register_user', (payload) => {
    try {
      const { rideId, userId } = payload || {};
      if (!rideId) return;
      
      userSockets.set(rideId, socket);
      socketToUser.set(socket.id, rideId);
      console.log(`👤 User registered for ride ${rideId} on socket ${socket.id}`);
      
      if (pendingUserNotifications.has(rideId)) {
        const notifications = pendingUserNotifications.get(rideId);
        notifications.forEach(notification => {
          socket.emit('notification', notification);
        });
        pendingUserNotifications.delete(rideId);
        console.log(`📱 Sent ${notifications.length} pending notifications to user ${rideId}`);
      }
    } catch (e) {
      console.error('register_user error', e);
    }
  });

  socket.on('register_driver', async (payload) => {
    try {
      console.log('📝 register_driver event received:', payload);
      
      const { driverId, location } = payload || {};
      if (!driverId) {
        console.log('❌ No driverId provided in register_driver');
        return;
      }
      
      const driverIdStr = driverId.toString();
      
      const driver = await Driver.findById(driverIdStr);
      if (!driver) {
        console.log(`❌ Driver ${driverIdStr} not found in database`);
        return;
      }
      
      console.log(`✅ Driver found in DB: ${driver.name} (${driverIdStr})`);
      
      driverSockets.set(driverIdStr, socket);
      socketToDriver.set(socket.id, driverIdStr);
      
      await Driver.findByIdAndUpdate(driverIdStr, { 
        available: true,
        online: true,
        ...(location && {
          lastKnownLocation: {
            lat: location.lat,
            lng: location.lng,
            updatedAt: new Date()
          }
        })
      });
      
      if (pendingDriverNotifications.has(driverIdStr)) {
        const notifications = pendingDriverNotifications.get(driverIdStr);
        notifications.forEach(notification => {
          socket.emit('notification', notification);
        });
        pendingDriverNotifications.delete(driverIdStr);
        console.log(`📱 Sent ${notifications.length} pending notifications to driver ${driverIdStr}`);
      }
      
      console.log(`🚗 Driver ${driverIdStr} (${driver.name}) registered on socket ${socket.id}`);
      logConnectedDrivers();
      
    } catch (e) {
      console.error('❌ register_driver error', e);
    }
  });

  socket.on('driver_location', async (payload) => {
    try {
      const { driverId, lat, lng, available } = payload || {};
      if (!driverId || !lat || !lng) return;

      await Driver.findByIdAndUpdate(driverId, {
        lastKnownLocation: {
          lat: lat,
          lng: lng,
          updatedAt: new Date()
        },
        available: available !== false
      });

      console.log(`📍 Updated location for driver ${driverId}: ${lat}, ${lng}`);
    } catch (error) {
      console.error('Error updating driver location:', error);
    }
  });

  socket.on('driver_response', (payload) => {
    console.log('🔄 driver_response received:', payload);
    
    const { rideId, driverId, accepted, info } = payload || {};
    if (!rideId || !driverId) {
      console.log('❌ Invalid driver_response payload');
      return;
    }
    
    if (pendingResponses.has(rideId)) {
      const { resolve, timeoutId } = pendingResponses.get(rideId);
      clearTimeout(timeoutId);
      pendingResponses.delete(rideId);
      
      resolve({ 
        accepted, 
        driverId, 
        info: info || {}
      });
    }
    
    if (accepted) {
      sendUserNotification(rideId, {
        type: 'driver_accepted',
        rideId,
        driverId,
        info,
        message: `Driver ${info?.name || 'Unknown'} accepted your ride request`,
        timestamp: new Date()
      });
    }
    
    io.emit('driver_response_server', payload);
  });

  socket.on('ride_request_sent', (payload) => {
    const { driverId, rideId } = payload || {};
    if (!driverId || !rideId) return;
    
    sendDriverNotification(driverId, {
      type: 'ride_request',
      rideId,
      message: 'New ride request received',
      timestamp: new Date()
    });
  });

  socket.on('update_location', async (payload) => {
    try {
      const { driverId, location } = payload || {};
      if (!driverId || !location) return;
      
      await Driver.findByIdAndUpdate(driverId, {
        lastKnownLocation: {
          lat: location.lat,
          lng: location.lng,
          updatedAt: new Date()
        }
      });
      console.log(`📍 Location updated for driver ${driverId}: ${location.lat}, ${location.lng}`);
    } catch (error) {
      console.error('Error in update_location:', error);
    }
  });

  socket.on('get_pending_notifications', async (payload) => {
    try {
      const { userId, userType } = payload || {};
      
      if (userType === 'user') {
        const rideId = socketToUser.get(socket.id);
        if (rideId && pendingUserNotifications.has(rideId)) {
          const notifications = pendingUserNotifications.get(rideId);
          socket.emit('pending_notifications', { notifications });
          pendingUserNotifications.delete(rideId);
        }
      } else if (userType === 'driver') {
        const driverId = socketToDriver.get(socket.id);
        if (driverId && pendingDriverNotifications.has(driverId)) {
          const notifications = pendingDriverNotifications.get(driverId);
          socket.emit('pending_notifications', { notifications });
          pendingDriverNotifications.delete(driverId);
        }
      }
    } catch (error) {
      console.error('Error getting pending notifications:', error);
    }
  });

  socket.on('disconnect', async (reason) => {
    const driverId = socketToDriver.get(socket.id);
    const rideId = socketToUser.get(socket.id);
    
    if (driverId) {
      driverSockets.delete(driverId);
      socketToDriver.delete(socket.id);
      
      try {
        await Driver.findByIdAndUpdate(driverId, { 
          online: false,
          available: false 
        });
        console.log(`🔴 Driver ${driverId} marked as offline`);
      } catch (error) {
        console.error('Error updating driver status on disconnect:', error);
      }
      
      console.log(`🚗 Driver ${driverId} disconnected: ${reason}`);
      logConnectedDrivers();
    }
    
    if (rideId) {
      userSockets.delete(rideId);
      socketToUser.delete(socket.id);
      console.log(`👤 User for ride ${rideId} disconnected: ${reason}`);
    }
    
    console.log('🔌 Socket disconnected:', socket.id, reason);
  });

  socket.on('error', (error) => {
    console.log('❌ Socket error:', error);
  });
});

/* ========================
   START SERVER
   ======================== */
const PORT = process.env.PORT || 3005;

async function startServer() {
  try {
    console.log("=".repeat(50));
    console.log("🚀 Starting Ride Service...");
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
        secret: process.env.SESSION_SECRET_KEY || 'ride-secret-key',
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
          mongoUrl: process.env.dbURL,
          collectionName: "ride_sessions"
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
    const FareRoutes = loadRoute('./Routes/fare.js', 'Fare Calculation');
    const RideActionsRoutes = loadRoute('./Routes/rideActions.js', 'Ride Actions');

    // Use routes
    app.use('/api', FareRoutes);
    app.use('/api/ride', RideActionsRoutes);
    console.log("✅ All routes mounted");

    /* ========================
       HEALTH & TEST ROUTES
       ======================== */
    
    // Root endpoint
    app.get('/', (req, res) => {
      const state = mongoose.connection.readyState;
      const connectedDrivers = Array.from(driverSockets.keys());
      
      res.json({ 
        success: true, 
        service: 'Safari Ride Service',
        status: 'running',
        database: state === 1 ? "connected" : "disconnected",
        dbState: state,
        dbStateText: getStateText(state),
        socketStats: {
          connectedDrivers: connectedDrivers.length,
          connectedUsers: Array.from(userSockets.keys()).length,
          totalSockets: io.engine.clientsCount
        },
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/api/health',
          dbHealth: '/db-health',
          debug: '/debug/drivers',
          fare: '/api/fare',
          ride: '/api/ride'
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
        message: 'Ride Service is running',
        port: process.env.PORT || 3005,
        database: state === 1 ? 'connected' : 'disconnected',
        socketConnections: io.engine.clientsCount,
        timestamp: new Date().toISOString()
      });
    });

    // Debug endpoint to check connected drivers
    app.get('/debug/drivers', (req, res) => {
      const connectedDrivers = Array.from(driverSockets.keys());
      res.json({
        connectedDrivers,
        total: connectedDrivers.length,
        userSockets: Array.from(userSockets.keys()),
        pendingResponses: Array.from(pendingResponses.keys()),
        pendingUserNotifications: Array.from(pendingUserNotifications.keys()),
        pendingDriverNotifications: Array.from(pendingDriverNotifications.keys())
      });
    });

    // Expose socket maps and helper functions to the app
    app.set('io', io);
    app.set('driverSockets', driverSockets);
    app.set('userSockets', userSockets);
    app.set('waitForDriverResponse', waitForDriverResponse);
    app.set('sendUserNotification', sendUserNotification);
    app.set('sendDriverNotification', sendDriverNotification);
    app.set('cancelRide', cancelRide);
    app.set('startRide', startRide);
    app.set('endRide', endRide);

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
        error: "Route not found",
        path: req.path,
        method: req.method
      });
    });

    // ✅ Start listening
    console.log("=".repeat(50));
    console.log(`🚕 Ride Service running on port ${PORT}`);
    console.log(`🗄️  Database: ${isDBReady() ? 'CONNECTED' : 'DISCONNECTED'}`);
    console.log(`📊 DB State: ${getStateText(mongoose.connection.readyState)}`);
    console.log(`🔌 Socket.IO: Ready for connections`);
    console.log(`🕐 Time: ${new Date().toISOString()}`);
    console.log("=".repeat(50));
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server listening on http://localhost:${PORT}`);
      console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
      console.log(`✅ Debug endpoint: http://localhost:${PORT}/debug/drivers`);
      console.log(`💰 Fare endpoint: http://localhost:${PORT}/api/fare`);
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
  console.log("🛑 Shutting down Ride Service gracefully...");
  console.log("=".repeat(50));
  
  // Close all socket connections
  io.close(() => {
    console.log("🔌 Socket.IO connections closed");
  });
  
  if (mongoose.connection.readyState === 1) {
    try {
      await mongoose.connection.close();
      console.log("🧹 MongoDB connection closed");
    } catch (err) {
      console.error("❌ Error closing MongoDB connection:", err.message);
    }
  }
  
  console.log("📊 Final stats:");
  console.log(`   Connected drivers: ${driverSockets.size}`);
  console.log(`   Connected users: ${userSockets.size}`);
  console.log(`   Pending notifications: ${pendingUserNotifications.size + pendingDriverNotifications.size}`);
  
  console.log("👋 Ride Service shutdown complete");
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
});

module.exports = { app, server, io };