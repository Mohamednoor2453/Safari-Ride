// admin-service/Routes/manageDrivers.js - UPDATED VERSION
const express = require('express');
const router = express.Router();
const driverController = require('../controllers/manageDriver.js');

// Get all unverified (pending) drivers
router.get('/unverified', driverController.getUnverifiedDrivers);

// Get all verified drivers
router.get('/verified', driverController.getVerifiedDrivers);

// Get ALL drivers (for debugging)
router.get('/all', driverController.getAllDrivers);

// Verify/Approve a driver
router.post('/verify', driverController.verifyDriver);

// Delete/Decline a driver
router.post('/delete', driverController.deleteDriver);

// Toggle driver status (online/offline)
router.post('/toggle-status', driverController.toggleDriverStatus);

// Get driver statistics
router.get('/stats', driverController.getDriverStats);

// Test endpoint with detailed info
router.get('/test', async (req, res) => {
  try {
    // Test database connection
    const Driver = require("../../shared/models/Driver");
    const totalDrivers = await Driver.countDocuments();
    const pendingCount = await Driver.countDocuments({ 
      $or: [{ verified: false }, { verified: { $exists: false } }] 
    });
    const verifiedCount = await Driver.countDocuments({ verified: true });
    
    res.json({ 
      success: true, 
      message: 'Admin drivers API is working',
      databaseStats: {
        totalDrivers,
        pendingDrivers: pendingCount,
        verifiedDrivers: verifiedCount
      },
      serverTime: new Date().toISOString(),
      endpoints: {
        unverifiedDrivers: 'GET /api/admin/drivers/unverified',
        verifiedDrivers: 'GET /api/admin/drivers/verified',
        allDrivers: 'GET /api/admin/drivers/all (debug)',
        verifyDriver: 'POST /api/admin/drivers/verify',
        deleteDriver: 'POST /api/admin/drivers/delete',
        toggleStatus: 'POST /api/admin/drivers/toggle-status',
        stats: 'GET /api/admin/drivers/stats'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Database connection test failed',
      details: error.message
    });
  }
});

module.exports = router;