// driver-service/Routes/driverProfile.js - FIXED VERSION
const express = require('express');
const router = express.Router();
const driverProfileController = require('../controllers/driverProfile.js');

// Apply auth middleware to all routes
router.use(driverProfileController.verifyToken);

// Get driver's profile
router.get('/driverProfile', driverProfileController.getDriverProfile);

// Toggle online status
router.post('/toggleOnline', driverProfileController.toggleOnlineStatus);

// Test authentication
router.get('/test-auth', driverProfileController.testAuth);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Driver profile API is working',
    timestamp: new Date().toISOString(),
    endpoints: {
      getProfile: 'GET /api/driverProfile',
      toggleOnline: 'POST /api/toggleOnline',
      testAuth: 'GET /api/test-auth'
    }
  });
});

module.exports = router;