// admin-service/controllers/manageDriver.js - COMPLETE FIXED VERSION
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Driver = require("../../shared/models/Driver");

/**
 * GET ALL UNVERIFIED (PENDING) DRIVERS
 */
exports.getUnverifiedDrivers = async (req, res) => {
  try {
    console.log('📋 Fetching unverified drivers...');
    
    // Query 1: Drivers with verified = false
    const unverifiedDrivers = await Driver.find({ verified: false })
      .sort({ createdAt: -1 });
    
    console.log(`✅ Found ${unverifiedDrivers.length} drivers with verified: false`);
    
    // Query 2: Drivers where verified field doesn't exist (backward compatibility)
    const noVerifiedFieldDrivers = await Driver.find({ 
      verified: { $exists: false } 
    }).sort({ createdAt: -1 });
    
    console.log(`✅ Found ${noVerifiedFieldDrivers.length} drivers without verified field`);
    
    // Combine both results
    const allPendingDrivers = [...unverifiedDrivers, ...noVerifiedFieldDrivers];
    
    console.log(`📊 Total pending drivers: ${allPendingDrivers.length}`);
    
    // Remove duplicates based on _id
    const uniqueDrivers = [];
    const seenIds = new Set();
    
    for (const driver of allPendingDrivers) {
      if (!seenIds.has(driver._id.toString())) {
        seenIds.add(driver._id.toString());
        uniqueDrivers.push(driver);
      }
    }
    
    console.log(`🚗 Unique pending drivers: ${uniqueDrivers.length}`);
    
    // Format response
    const formattedDrivers = uniqueDrivers.map(driver => ({
      _id: driver._id,
      name: driver.name || 'Unknown',
      phone: driver.plainPhone || 'N/A',
      carType: driver.carType || 'N/A',
      carPlate: driver.plainPlate || 'N/A',
      driverImage: driver.driverImage && driver.driverImage.length > 0 
        ? driver.driverImage[0] 
        : 'https://via.placeholder.com/150',
      idImage: driver.IdImage && driver.IdImage.length > 0 
        ? driver.IdImage[0] 
        : null,
      status: "pending",
      verified: driver.verified || false,
      createdAt: driver.createdAt || new Date(),
      updatedAt: driver.updatedAt || new Date()
    }));

    // Log first few drivers for debugging
    if (formattedDrivers.length > 0) {
      console.log('📝 Sample pending drivers:');
      formattedDrivers.slice(0, 3).forEach((driver, index) => {
        console.log(`${index + 1}. ${driver.name} - ${driver.phone} - ${driver.carPlate}`);
      });
    }

    res.status(200).json({
      success: true,
      count: formattedDrivers.length,
      data: formattedDrivers,
      message: `Found ${formattedDrivers.length} pending drivers`
    });
  } catch (error) {
    console.error("❌ Error fetching pending drivers:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch pending drivers",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * VERIFY / APPROVE DRIVER
 */
exports.verifyDriver = async (req, res) => {
  try {
    const { driverId } = req.body;

    console.log(`✅ Verifying driver with ID: ${driverId}`);

    if (!driverId) {
      return res.status(400).json({
        success: false,
        error: "Driver ID is required"
      });
    }

    // First, find the driver to ensure it exists
    const existingDriver = await Driver.findById(driverId);
    if (!existingDriver) {
      console.log(`❌ Driver not found: ${driverId}`);
      return res.status(404).json({
        success: false,
        error: "Driver not found"
      });
    }

    console.log(`📝 Driver found: ${existingDriver.name} (${existingDriver.plainPhone})`);

    // Update the driver
    const driver = await Driver.findByIdAndUpdate(
      driverId,
      {
        verified: true,
        verifiedAt: new Date(),
        online: true,
        available: true
      },
      { new: true, runValidators: true }
    );

    if (!driver) {
      return res.status(404).json({
        success: false,
        error: "Driver not found after update"
      });
    }

    console.log(`🎉 Driver "${driver.name}" verified successfully!`);

    res.status(200).json({
      success: true,
      message: `Driver "${driver.name}" verified successfully!`,
      driver: {
        id: driver._id,
        name: driver.name,
        phone: driver.plainPhone,
        carPlate: driver.plainPlate,
        verified: driver.verified,
        verifiedAt: driver.verifiedAt
      }
    });
  } catch (error) {
    console.error("❌ Error verifying driver:", error);
    res.status(500).json({
      success: false,
      error: "Failed to verify driver",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET ALL VERIFIED DRIVERS
 */
exports.getVerifiedDrivers = async (req, res) => {
  try {
    console.log('📋 Fetching verified drivers...');
    
    const drivers = await Driver.find({ verified: true })
      .sort({ verifiedAt: -1, createdAt: -1 });

    console.log(`✅ Found ${drivers.length} verified drivers`);

    const formattedDrivers = drivers.map(driver => ({
      _id: driver._id,
      name: driver.name || 'Unknown',
      phone: driver.plainPhone || 'N/A',
      carType: driver.carType || 'N/A',
      carPlate: driver.plainPlate || 'N/A',
      online: driver.online || false,
      available: driver.available || false,
      verifiedAt: driver.verifiedAt || driver.createdAt,
      lastLogin: driver.lastLogin,
      driverImage: driver.driverImage && driver.driverImage.length > 0 
        ? driver.driverImage[0] 
        : 'https://via.placeholder.com/150'
    }));

    // Log first few drivers for debugging
    if (formattedDrivers.length > 0) {
      console.log('📝 Sample verified drivers:');
      formattedDrivers.slice(0, 3).forEach((driver, index) => {
        console.log(`${index + 1}. ${driver.name} - ${driver.phone} - Online: ${driver.online}`);
      });
    }

    res.status(200).json({
      success: true,
      count: formattedDrivers.length,
      data: formattedDrivers,
      message: `Found ${formattedDrivers.length} verified drivers`
    });
  } catch (error) {
    console.error("❌ Error fetching verified drivers:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch verified drivers",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * DELETE / DECLINE DRIVER
 */
exports.deleteDriver = async (req, res) => {
  try {
    const { driverId } = req.body;

    console.log(`🗑️ Deleting driver with ID: ${driverId}`);

    if (!driverId) {
      return res.status(400).json({
        success: false,
        error: "Driver ID is required"
      });
    }

    // First, find the driver to get details for logging
    const driverToDelete = await Driver.findById(driverId);
    
    if (!driverToDelete) {
      console.log(`❌ Driver not found: ${driverId}`);
      return res.status(404).json({
        success: false,
        error: "Driver not found"
      });
    }

    console.log(`📝 Driver found for deletion: ${driverToDelete.name}`);

    const result = await Driver.findByIdAndDelete(driverId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: "Driver not found"
      });
    }

    console.log(`✅ Driver "${driverToDelete.name}" deleted successfully`);

    res.status(200).json({
      success: true,
      message: `Driver "${driverToDelete.name}" deleted successfully`,
      deletedDriver: {
        name: driverToDelete.name,
        phone: driverToDelete.plainPhone,
        carPlate: driverToDelete.plainPlate
      }
    });
  } catch (error) {
    console.error("❌ Error deleting driver:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete driver",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * TOGGLE DRIVER ONLINE STATUS
 */
exports.toggleDriverStatus = async (req, res) => {
  try {
    const { driverId, status } = req.body;

    console.log(`🔄 Toggling driver status: ${driverId} to ${status}`);

    if (!driverId || typeof status !== "boolean") {
      return res.status(400).json({
        success: false,
        error: "Driver ID and status (true/false) are required"
      });
    }

    const driver = await Driver.findByIdAndUpdate(
      driverId,
      { 
        online: status, 
        available: status,
        lastActive: status ? new Date() : null
      },
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({
        success: false,
        error: "Driver not found"
      });
    }

    console.log(`✅ Driver "${driver.name}" status updated to: ${status ? 'ONLINE' : 'OFFLINE'}`);

    res.status(200).json({
      success: true,
      message: `Driver "${driver.name}" is now ${status ? 'online' : 'offline'}`,
      data: {
        online: driver.online,
        available: driver.available,
        name: driver.name,
        phone: driver.plainPhone
      }
    });
  } catch (error) {
    console.error("❌ Error toggling driver status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update driver status",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * DRIVER STATISTICS
 */
exports.getDriverStats = async (req, res) => {
  try {
    console.log('📊 Fetching driver statistics...');
    
    const [
      totalDrivers,
      verifiedDrivers,
      pendingDrivers,
      activeDrivers,
      driversWithNoVerifiedField
    ] = await Promise.all([
      Driver.countDocuments(),
      Driver.countDocuments({ verified: true }),
      Driver.countDocuments({ verified: false }),
      Driver.countDocuments({ verified: true, online: true }),
      Driver.countDocuments({ verified: { $exists: false } })
    ]);

    // Calculate total pending (verified: false + no verified field)
    const totalPending = pendingDrivers + driversWithNoVerifiedField;

    console.log(`📊 Stats: Total=${totalDrivers}, Verified=${verifiedDrivers}, Pending=${totalPending}, Active=${activeDrivers}`);

    res.status(200).json({
      success: true,
      data: {
        totalDrivers,
        verifiedDrivers,
        pendingDrivers: totalPending,
        activeDrivers,
        detailed: {
          verifiedFalse: pendingDrivers,
          noVerifiedField: driversWithNoVerifiedField
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ Error fetching driver stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get driver statistics",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET ALL DRIVERS (FOR DEBUGGING)
 */
exports.getAllDrivers = async (req, res) => {
  try {
    console.log('🔍 DEBUG: Fetching ALL drivers...');
    
    const drivers = await Driver.find({})
      .sort({ createdAt: -1 })
      .select('name plainPhone plainPlate verified online createdAt updatedAt');

    console.log(`🔍 DEBUG: Found ${drivers.length} total drivers in database`);

    const formattedDrivers = drivers.map(driver => ({
      _id: driver._id,
      name: driver.name,
      phone: driver.plainPhone,
      carPlate: driver.plainPlate,
      verified: driver.verified || false,
      online: driver.online || false,
      createdAt: driver.createdAt,
      updatedAt: driver.updatedAt,
      hasVerifiedField: driver.verified !== undefined
    }));

    // Log all drivers for debugging
    formattedDrivers.forEach((driver, index) => {
      console.log(`${index + 1}. ${driver.name} - ${driver.phone} - Verified: ${driver.verified} - Online: ${driver.online}`);
    });

    res.status(200).json({
      success: true,
      count: formattedDrivers.length,
      data: formattedDrivers,
      message: `Found ${formattedDrivers.length} total drivers in database`
    });
  } catch (error) {
    console.error("❌ DEBUG Error fetching all drivers:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch all drivers",
      details: error.message
    });
  }
};