// driver-service/controllers/driverProfile.js - FIXED VERSION
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Driver = require("../../shared/models/Driver.js");
const jwt = require('jsonwebtoken'); // Added JWT support

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  try {
    // Check for token in Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        req.user = decoded;
        return next();
      } catch (jwtError) {
        console.log('JWT verification failed:', jwtError.message);
      }
    }
    
    // Fallback to session check (for backward compatibility)
    if (req.session && req.session.user && req.session.user.userId) {
      return next();
    }
    
    // If no authentication method works
    return res.status(401).json({ 
      success: false, 
      error: "You must be logged in to access this resource",
      message: "Authentication required"
    });
    
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      success: false, 
      error: "Authentication error" 
    });
  }
};

// Get driver's profile
exports.getDriverProfile = async (req, res) => {
  try {
    let driverId;
    
    // Check if using JWT authentication
    if (req.user && req.user.id) {
      driverId = req.user.id;
      console.log('📱 JWT auth - Driver ID:', driverId);
    } 
    // Check if using session authentication
    else if (req.session.user && req.session.user.userId) {
      driverId = req.session.user.userId;
      console.log('📱 Session auth - Driver ID:', driverId);
    } 
    // Check if driverId is in query params (for testing)
    else if (req.query.driverId) {
      driverId = req.query.driverId;
      console.log('📱 Query param auth - Driver ID:', driverId);
    } 
    else {
      return res.status(401).json({ 
        success: false, 
        error: "You must be logged in to access this resource",
        message: "No authentication found"
      });
    }

    console.log('🔍 Fetching driver profile for ID:', driverId);
    
    const driver = await Driver.findById(driverId);

    if (!driver) {
      console.log('❌ Driver not found with ID:', driverId);
      return res.status(404).json({ 
        success: false, 
        error: "Driver not found" 
      });
    }

    console.log('✅ Driver found:', driver.name, '- Verified:', driver.verified);

    return res.status(200).json({
      success: true,
      data: {
        _id: driver._id,
        name: driver.name,
        phone: driver.plainPhone,
        carType: driver.carType,
        driverImage: driver.driverImage && driver.driverImage.length > 0 
          ? driver.driverImage[0] 
          : 'https://via.placeholder.com/150',
        plainPlate: driver.plainPlate,
        online: driver.online || false,
        available: driver.available || false,
        verified: driver.verified || false,
        verifiedAt: driver.verifiedAt,
        lastLogin: driver.lastLogin
      }
    });
  } catch (error) {
    console.error('❌ Error in getDriverProfile:', error);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Toggle online status
exports.toggleOnlineStatus = async (req, res) => {
  try {
    let driverId;
    
    // Check authentication method
    if (req.user && req.user.id) {
      driverId = req.user.id;
    } else if (req.session.user && req.session.user.userId) {
      driverId = req.session.user.userId;
    } else {
      return res.status(401).json({ 
        success: false, 
        error: 'Not authenticated' 
      });
    }

    const { online, location, carType } = req.body;
    
    console.log(`🔄 Toggle online status for driver ${driverId} to ${online}`);

    const updateData = { 
      online,
      lastActive: new Date(),
      available: online // Set available to same as online
    };

    // If going online, update location and car type
    if (online) {
      if (location) {
        updateData.location = {
          type: 'Point',
          coordinates: [location.lng, location.lat],
          lastUpdated: new Date()
        };
      }
      
      if (carType) {
        updateData.carType = carType;
      }
    }

    const driver = await Driver.findByIdAndUpdate(
      driverId, 
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!driver) {
      return res.status(404).json({ 
        success: false, 
        error: 'Driver not found' 
      });
    }

    console.log(`✅ Driver ${driver.name} is now ${online ? 'online' : 'offline'}`);

    // Emit socket event if available
    if (req.app.get('io') && online) {
      const io = req.app.get('io');
      io.emit('driver_status_changed', { 
        driverId: driver._id, 
        online: true,
        location: updateData.location,
        carType: driver.carType
      });
    }

    res.status(200).json({ 
      success: true, 
      message: `Driver is now ${online ? 'online' : 'offline'}`,
      online: driver.online,
      available: driver.available,
      location: updateData.location,
      carType: driver.carType,
      driver: {
        id: driver._id,
        name: driver.name,
        phone: driver.plainPhone
      }
    });

  } catch (error) {
    console.error('❌ Error toggling online status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update status',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Test endpoint to verify authentication
exports.testAuth = async (req, res) => {
  try {
    let authMethod = 'none';
    let driverId = null;
    
    if (req.user && req.user.id) {
      authMethod = 'jwt';
      driverId = req.user.id;
    } else if (req.session.user && req.session.user.userId) {
      authMethod = 'session';
      driverId = req.session.user.userId;
    }
    
    res.status(200).json({
      success: true,
      message: 'Auth test successful',
      auth: {
        method: authMethod,
        driverId: driverId,
        sessionId: req.sessionID,
        headers: req.headers.authorization ? 'Authorization header present' : 'No auth header'
      }
    });
  } catch (error) {
    console.error('Auth test error:', error);
    res.status(500).json({
      success: false,
      error: 'Auth test failed'
    });
  }
};

// Export the auth middleware
exports.verifyToken = verifyToken;