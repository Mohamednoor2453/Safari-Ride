 const path = require('path');
 require('dotenv').config({ path: path.join(__dirname, '../.env') });

 const bcrypt = require('bcrypt');
 const Driver = require('../Models/driver.js');
 const cloudinary = require('cloudinary').v2;
 const multer = require('multer');

 // Cloudinary Config
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer → memory buffer
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

//upload middleware
const uploadImage = (fileBuffer) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: 'drivers' },
            (error, result) => {
                if (error) reject(error);
                else resolve(result.secure_url);
            }
        );
        stream.end(fileBuffer);
    });
};

const encryptData = async (val) => {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(val.toString(), salt);
};


//get driver's profile

exports.getDriverProfile = async (req, res) => {
    try {
        if (!req.session.user || !req.session.user.userId) {
            return res.status(401).json({ success: false, error: "Not authenticated" });
        }

        const driverId = req.session.user.userId;

        const driver = await Driver.findById(driverId);

        if (!driver) {
            return res.status(404).json({ success: false, error: "Driver not found" });
        }

        return res.status(200).json({
            success: true,
            data: {
                name: driver.name,
                phone: driver.plainPhone,
                carType: driver.carType,
                driverImage: driver.driverImage[0],
                plainPlate: driver.plainPlate,
                online: driver.online
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
};



// Toggle online status
exports.toggleOnlineStatus = async (req, res) => {
  try {
    if (!req.session.user || !req.session.user.userId) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }

    const driverId = req.session.user.userId;

    // Toggle online status in one go without triggering full validation
    const driver = await Driver.findByIdAndUpdate(
      driverId,
      [{ $set: { online: { $not: "$online" } } }], // toggle
      { new: true, runValidators: false } // ✅ avoid validation errors for required fields
    );

    if (!driver) {
      return res.status(404).json({ success: false, error: "Driver not found" });
    }

    return res.status(200).json({
      success: true,
      online: driver.online,
      message: driver.online ? "You are now online" : "You are now offline",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};
