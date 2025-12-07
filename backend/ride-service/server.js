// backend/ride-service/server.js
const express = require('express');
const connectDB = require("../shared/db");
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const path = require('path');
require('dotenv').config();

const session = require('express-session');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// mongo db connection
connectDB();

app.use(
  session({
    secret: process.env.SESSION_SECRET_KEY,
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

// ROUTES
const FareRoutes = require("./Routes/fare.js");

//api
app.use('/api', FareRoutes)

// START SERVER
const PORT = process.env.PORT || 3005;
const server = require('http').createServer(app);

// Socket.IO
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Import Driver model to update locations
const Driver = require("../shared/models/Driver");

// Enhanced in-memory storage
const driverSockets = new Map(); // driverId -> socket
const socketToDriver = new Map(); // socketId -> driverId
const userSockets = new Map(); // userId/rideId -> socket
const socketToUser = new Map(); // socketId -> userId/rideId

// Store pending driver responses
const pendingResponses = new Map(); // rideId -> { resolve, reject, timeoutId }

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

io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);

  // User registers with ride
  socket.on('register_user', (payload) => {
    try {
      const { rideId, userId } = payload || {};
      if (!rideId) return;
      
      userSockets.set(rideId, socket);
      socketToUser.set(socket.id, rideId);
      console.log(`👤 User registered for ride ${rideId} on socket ${socket.id}`);
    } catch (e) {
      console.error('register_user error', e);
    }
  });

  // Driver registers - ENHANCED WITH DEBUGGING
  socket.on('register_driver', async (payload) => {
    try {
      console.log('📝 register_driver event received:', payload);
      
      const { driverId, location } = payload || {};
      if (!driverId) {
        console.log('❌ No driverId provided in register_driver');
        return;
      }
      
      const driverIdStr = driverId.toString();
      
      // Check if driver exists in database
      const driver = await Driver.findById(driverIdStr);
      if (!driver) {
        console.log(`❌ Driver ${driverIdStr} not found in database`);
        return;
      }
      
      console.log(`✅ Driver found in DB: ${driver.name} (${driverIdStr})`);
      
      // Store socket connection
      driverSockets.set(driverIdStr, socket);
      socketToDriver.set(socket.id, driverIdStr);
      
      // Update driver availability when they register
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
      
      console.log(`🚗 Driver ${driverIdStr} (${driver.name}) registered on socket ${socket.id}`);
      logConnectedDrivers();
      
    } catch (e) {
      console.error('❌ register_driver error', e);
    }
  });

  // Driver location updates - SAVE TO DATABASE
  socket.on('driver_location', async (payload) => {
    try {
      const { driverId, lat, lng, available } = payload || {};
      if (!driverId || !lat || !lng) return;

      // Update driver location in database
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

  // Driver responds to ride request - FIXED: Handle properly
  socket.on('driver_response', (payload) => {
    console.log('🔄 driver_response received:', payload);
    
    const { rideId, driverId, accepted, info } = payload || {};
    if (!rideId || !driverId) {
      console.log('❌ Invalid driver_response payload');
      return;
    }
    
    // Check if we're waiting for this response
    if (pendingResponses.has(rideId)) {
      const { resolve, timeoutId } = pendingResponses.get(rideId);
      clearTimeout(timeoutId);
      pendingResponses.delete(rideId);
      
      // Resolve the promise with the driver's response
      resolve({ 
        accepted, 
        driverId, 
        info: info || {}
      });
    }
    
    // Also emit to the specific user who requested the ride
    const userSocket = userSockets.get(rideId);
    if (userSocket) {
      userSocket.emit('driver_response_user', payload);
    }
    
    // Broadcast to all (including the matching controller)
    io.emit('driver_response_server', payload);
  });

  // Update location event
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

  socket.on('disconnect', async (reason) => {
    const driverId = socketToDriver.get(socket.id);
    const rideId = socketToUser.get(socket.id);
    
    if (driverId) {
      driverSockets.delete(driverId);
      socketToDriver.delete(socket.id);
      
      // Mark driver as offline when they disconnect
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

// Expose socket maps and helper functions to the app
app.set('io', io);
app.set('driverSockets', driverSockets);
app.set('userSockets', userSockets);
app.set('waitForDriverResponse', waitForDriverResponse);

// Add debug endpoint to check connected drivers
app.get('/debug/drivers', (req, res) => {
  const connectedDrivers = Array.from(driverSockets.keys());
  res.json({
    connectedDrivers,
    total: connectedDrivers.length,
    userSockets: Array.from(userSockets.keys()),
    pendingResponses: Array.from(pendingResponses.keys())
  });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚗 Ride Service running on port ${PORT}`);
  console.log(`📍 Debug endpoint: http://localhost:${PORT}/debug/drivers`);
});