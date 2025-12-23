// driver-service/controllers/auth.js - COMPLETE FIXED VERSION
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); // Added missing import
const Driver = require("../../shared/models/Driver.js");
const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// Cloudinary Config
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer Setup - Fix for React Native FormData
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // Increase to 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
}).fields([
    { name: 'driverImage', maxCount: 1 },
    { name: 'idImage', maxCount: 1 }
]);

exports.uploadMiddleware = (req, res, next) => {
    upload(req, files, (err) => {
        if (err) {
            console.error('Multer upload error:', err.message);
            return res.status(400).json({ 
                success: false, 
                error: err.message || "File upload failed" 
            });
        }

        // Check if both files are uploaded
        if (!req.files || !req.files.driverImage || !req.files.idImage) {
            return res.status(400).json({ 
                success: false, 
                error: "Please upload both driver image AND ID image." 
            });
        }

        console.log(`Uploaded ${req.files.driverImage.length + req.files.idImage.length} images`);
        next();
    });
};

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
    console.log('Files received:', files ? Object.keys(files) : 'No files');

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
    const existingPlate = await Driver.findOne({ plainPlate: carPlate.trim() });
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
      plainPlate: carPlate.trim(),
      carType: carType.trim(),
      driverImage: driverImageUrl ? [driverImageUrl] : [],
      IdImage: idImageUrl ? [idImageUrl] : [],
      verified: false,
      online: false,
      available: false
    });

    await newDriver.save();

    console.log('Driver registered successfully:', newDriver._id);

    return res.status(201).json({
      success: true,
      message: "Driver registered successfully. Awaiting admin verification.",
      driverId: newDriver._id
    });

  } catch (error) {
    console.error("Driver registration error:", error);
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

    console.log('Login attempt:', { phone, carPlate });

    if (!phone || !carPlate) {
      return res.status(400).json({
        success: false,
        error: "Phone number and car plate are required"
      });
    }

    // Find driver by plainPhone (unencrypted field for admin use)
    const driver = await Driver.findOne({ 
      plainPhone: phone.trim() 
    });

    if (!driver) {
      console.log('Driver not found with phone:', phone);
      return res.status(401).json({
        success: false,
        error: "Invalid login credentials"
      });
    }

    // Verify car plate
    const plateMatch = await bcrypt.compare(carPlate.trim(), driver.carPlate);
    if (!plateMatch) {
      console.log('Car plate mismatch for driver:', driver._id);
      return res.status(401).json({
        success: false,
        error: "Invalid login credentials"
      });
    }

    // Check verification status
    if (!driver.verified) {
      console.log('Driver not verified:', driver._id);
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
        phone: driver.plainPhone
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: "7d" }
    );

    // Update last login time
    driver.lastLogin = new Date();
    await driver.save();

    console.log('Driver logged in successfully:', driver._id);

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
        verified: driver.verified
      }
    });

  } catch (error) {
    console.error("Driver login error:", error);
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
        req.session.destroy();
        res.json({ success: true, message: "Logged out successfully" });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ success: false, error: "Logout failed" });
    }
};

// GET DRIVER STATUS
exports.getDriverStatus = async (req, res) => {
    try {
        if (!req.session.user || !req.session.user.userId) {
            return res.status(401).json({ 
                success: false, 
                error: "Not authenticated" 
            });
        }

        const driver = await Driver.findById(req.session.user.userId);
        
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