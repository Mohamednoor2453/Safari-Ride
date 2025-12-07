 const path = require('path');
 require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Driver = require("../../shared/models/Driver.js");
 const bcrypt = require('bcrypt');


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
                _id: driver._id,
                name: driver.name,
                phone: driver.plainPhone,
                carType: driver.carType,
                driverImage: driver.driverImage[0],
                plainPlate: driver.plainPlate,
                online: driver.online || false
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
};



exports.toggleOnlineStatus = async (req, res) => {
  try {
    if (!req.session.user || !req.session.user.userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const { online, location, carType } = req.body;
    const driverId = req.session.user.userId;

    const updateData = { 
      online,
      lastActive: new Date()
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
      return res.status(404).json({ success: false, error: 'Driver not found' });
    }

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
      location: updateData.location,
      carType: driver.carType
    });

  } catch (error) {
    console.error('❌ Error toggling online status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update status',
      details: error.message 
    });
  }
};
