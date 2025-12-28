// driver-service/controllers/auth.js - FIXED VERSION
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Driver = require("../../shared/models/Driver.js");
const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// Cloudinary Config
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer Setup
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

exports.uploadMiddleware = upload.fields([
    { name: 'driverImage', maxCount: 1 },
    { name: 'idImage', maxCount: 1 }
]);

// Upload Image Helper
const uploadImage = async (fileBuffer) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { 
                folder: 'safari_ride/drivers',
                resource_type: 'image'
            },
            (error, result) => {
                if (error) {
                    console.error('Cloudinary upload error:', error);
                    reject(error);
                } else {
                    console.log('Image uploaded to Cloudinary:', result.secure_url);
                    resolve(result.secure_url);
                }
            }
        );
        stream.end(fileBuffer);
    });
};

exports.registerDriver = async (req, res) => {
  try {
    const {
      name,
      phone,
      carPlate,
      carType
    } = req.body;

    const files = req.files;

    console.log('Registration request received:', { name, phone, carPlate, carType });

    // Validate required fields
    if (!name || !phone || !carPlate || !carType) {
      return res.status(400).json({
        success: false,
        error: "All fields are required: name, phone, carPlate, carType"
      });
    }

    // Check if driver already exists
    const existingDriver = await Driver.findOne({ plainPhone: phone.trim() });
    if (existingDriver) {
      return res.status(400).json({
        success: false,
        error: "Driver with this phone number already exists"
      });
    }

    // Check if car plate already exists
    const existingPlate = await Driver.findOne({ plainPlate: carPlate.trim().toUpperCase() });
    if (existingPlate) {
      return res.status(400).json({
        success: false,
        error: "Car plate number already registered"
      });
    }

    // Encrypt sensitive data
    const encryptedPhone = await bcrypt.hash(phone.trim(), 10);
    const encryptedPlate = await bcrypt.hash(carPlate.trim(), 10);

    // Upload images to Cloudinary
    let driverImageUrl = '';
    let idImageUrl = '';

    try {
      if (files && files.driverImage && files.driverImage[0]) {
        driverImageUrl = await uploadImage(files.driverImage[0].buffer);
      }
      
      if (files && files.idImage && files.idImage[0]) {
        idImageUrl = await uploadImage(files.idImage[0].buffer);
      }
    } catch (uploadError) {
      console.error('Image upload error:', uploadError);
      return res.status(500).json({
        success: false,
        error: "Failed to upload images. Please try again."
      });
    }

    // Create new driver
    const newDriver = new Driver({
      name: name.trim(),
      phone: encryptedPhone,
      plainPhone: phone.trim(),
      carPlate: encryptedPlate,
      plainPlate: carPlate.trim().toUpperCase(),
      carType: carType.trim(),
      driverImage: driverImageUrl ? [driverImageUrl] : [],
      IdImage: idImageUrl ? [idImageUrl] : [],
      verified: false,
      online: false,
      available: false
    });

    await newDriver.save();

    console.log('✅ Driver registered successfully:', newDriver._id);

    return res.status(201).json({
      success: true,
      message: "Driver registered successfully. Awaiting admin verification.",
      driverId: newDriver._id
    });

  } catch (error) {
    console.error("❌ Driver registration error:", error);
    return res.status(500).json({
      success: false,
      error: "Driver registration failed",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * DRIVER LOGIN
 */
exports.loginDriver = async (req, res) => {
  try {
    const { phone, carPlate } = req.body;

    console.log('🔑 Login attempt:', { phone, carPlate });

    if (!phone || !carPlate) {
      return res.status(400).json({
        success: false,
        error: "Phone number and car plate are required"
      });
    }

    // Find driver by plainPhone
    const driver = await Driver.findOne({ 
      plainPhone: phone.trim() 
    });

    if (!driver) {
      console.log('❌ Driver not found with phone:', phone);
      return res.status(401).json({
        success: false,
        error: "Invalid phone number or car plate"
      });
    }

    // Verify car plate
    const plateMatch = await bcrypt.compare(carPlate.trim(), driver.carPlate);
    if (!plateMatch) {
      console.log('❌ Car plate mismatch for driver:', driver._id);
      return res.status(401).json({
        success: false,
        error: "Invalid phone number or car plate"
      });
    }

    // Check verification status
    if (!driver.verified) {
      console.log('⚠️ Driver not verified:', driver._id);
      return res.status(403).json({
        success: false,
        error: "Your account is pending verification by admin.",
        status: "pending",
        driverId: driver._id
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: driver._id, 
        role: "driver",
        phone: driver.plainPhone,
        name: driver.name
      },
      process.env.JWT_SECRET || 'safari-ride-secret-key-2024',
      { expiresIn: "7d" }
    );

    // Set session data (for backward compatibility)
    req.session.user = {
      userId: driver._id,
      phone: driver.plainPhone,
      name: driver.name,
      role: 'driver'
    };

    // Update last login time
    driver.lastLogin = new Date();
    await driver.save();

    console.log('✅ Driver logged in successfully:', driver.name, '- ID:', driver._id);

    return res.status(200).json({
      success: true,
      token,
      driver: {
        id: driver._id,
        name: driver.name,
        phone: driver.plainPhone,
        carType: driver.carType,
        carPlate: driver.plainPlate,
        online: driver.online,
        available: driver.available,
        verified: driver.verified,
        driverImage: driver.driverImage && driver.driverImage.length > 0 
          ? driver.driverImage[0] 
          : null
      },
      sessionId: req.sessionID
    });

  } catch (error) {
    console.error("❌ Driver login error:", error);
    return res.status(500).json({
      success: false,
      error: "Login failed",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// LOGOUT DRIVER
exports.logoutDriver = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destroy error:', err);
                return res.status(500).json({ 
                    success: false, 
                    error: "Logout failed" 
                });
            }
            
            res.json({ 
                success: true, 
                message: "Logged out successfully" 
            });
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ 
            success: false, 
            error: "Logout failed" 
        });
    }
};

// GET DRIVER STATUS
exports.getDriverStatus = async (req, res) => {
    try {
        let driverId;
        
        // Check JWT first
        if (req.user && req.user.id) {
            driverId = req.user.id;
        } 
        // Then check session
        else if (req.session.user && req.session.user.userId) {
            driverId = req.session.user.userId;
        } else {
            return res.status(401).json({ 
                success: false, 
                error: "Not authenticated" 
            });
        }

        const driver = await Driver.findById(driverId);
        
        if (!driver) {
            return res.status(404).json({ 
                success: false, 
                error: "Driver not found" 
            });
        }

        res.json({
            success: true,
            driver: {
                id: driver._id,
                name: driver.name,
                phone: driver.plainPhone,
                carType: driver.carType,
                carPlate: driver.plainPlate,
                verified: driver.verified,
                online: driver.online,
                available: driver.available
            }
        });
    } catch (error) {
        console.error('GetDriverStatus error:', error);
        res.status(500).json({ 
            success: false, 
            error: "Server error" 
        });
    }
};

// Test endpoint
exports.testEndpoint = (req, res) => {
    res.json({
        success: true,
        message: 'Driver auth API is working',
        timestamp: new Date().toISOString(),
        endpoints: {
            register: 'POST /api/register',
            login: 'POST /api/login',
            logout: 'POST /api/logout',
            status: 'GET /api/status'
        }
    });
};