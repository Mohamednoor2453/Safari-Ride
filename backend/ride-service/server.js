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
const RideActionsRoutes = require("./Routes/rideActions.js");

//api
app.use('/api', FareRoutes);
app.use('/api/ride', RideActionsRoutes);

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
    // User is online, send immediately
    userSocket.emit('notification', notification);
  } else {
    // User is offline, store notification
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
    // Driver is online, send immediately
    driverSocket.emit('notification', notification);
  } else {
    // Driver is offline, store notification
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

    // Update ride status
    ride.status = 'cancelled';
    ride.cancellationReason = reason;
    ride.cancelledAt = new Date();
    await ride.save();

    // Notify driver if assigned
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
        
        // Also send as notification
        sendDriverNotification(driverId, {
          type: 'ride_cancelled',
          rideId,
          message: 'Ride has been cancelled by the user',
          timestamp: new Date()
        });
        
        console.log(`📢 Notified driver ${driverId} about ride cancellation`);
      }
      
      // Update driver availability
      await Driver.findByIdAndUpdate(driverId, {
        available: true,
        online: true
      });
    }

    // Notify user
    const userSocket = userSockets.get(rideId);
    if (userSocket) {
      userSocket.emit('ride_cancelled_user', {
        rideId,
        message: 'Your ride has been cancelled',
        timestamp: new Date()
      });
    }

    // Clean up pending responses
    if (pendingResponses.has(rideId)) {
      const { timeoutId } = pendingResponses.get(rideId);
      clearTimeout(timeoutId);
      pendingResponses.delete(rideId);
    }

    // Clean up socket mappings
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

    // Update ride status
    ride.status = 'in_progress';
    ride.startedAt = new Date();
    await ride.save();

    // Update driver status
    await Driver.findByIdAndUpdate(driverId, {
      available: false // Driver is busy with current ride
    });

    // Notify user
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

    // Update ride status
    ride.status = 'completed';
    ride.completedAt = new Date();
    await ride.save();

    // Update driver status
    await Driver.findByIdAndUpdate(driverId, {
      available: true, // Driver is available again
      online: true
    });

    // Notify user
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

    // Clean up socket mappings
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
      
      // Send any pending notifications for this ride
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

  // Driver registers
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
      
      // Send any pending notifications for this driver
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

  // Driver location updates
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

  // Driver responds to ride request
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
    
    // Send notification to user
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
    
    // Broadcast to all (including the matching controller)
    io.emit('driver_response_server', payload);
  });

  // Ride request sent to driver
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

  // Get pending notifications
  socket.on('get_pending_notifications', async (payload) => {
    try {
      const { userId, userType } = payload || {}; // userType: 'user' or 'driver'
      
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
app.set('sendUserNotification', sendUserNotification);
app.set('sendDriverNotification', sendDriverNotification);
app.set('cancelRide', cancelRide);
app.set('startRide', startRide);
app.set('endRide', endRide);

// Add debug endpoint to check connected drivers
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

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚗 Ride Service running on port ${PORT}`);
  console.log(`📍 Debug endpoint: http://localhost:${PORT}/debug/drivers`);
});