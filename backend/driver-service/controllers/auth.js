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

// Multer Setup
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }
}).array("images", 5);

exports.uploadMiddleware = (req, res, next) => {
    upload(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, error: err.message });

        if (!req.files || req.files.length < 2)
            return res.status(400).json({ success: false, error: "Upload driver image AND ID image." });

        next();
    });
};

// Encrypt
const encryptData = async (val) => {
    if (!val) return "";
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(val.toString(), salt);
};

// Upload Image Helper
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

// REGISTER DRIVER
exports.registerDriver = async (req, res) => {
    try {
        const { name, phone, carPlate, carType } = req.body;

        if (!name || !phone || !carPlate || !carType)
            return res.status(400).json({ success: false, error: "All fields are required" });

        if (phone.length < 10 || phone.length > 14)
            return res.status(400).json({ success: false, error: "Phone must be 10-14 characters" });

        // Check if exists by decrypt comparison
        const drivers = await Driver.find();
        for (let d of drivers) {
            const phoneMatch = await bcrypt.compare(phone.toString(), d.phone);
            const plateMatch = await bcrypt.compare(carPlate.toString(), d.carPlate);
            if (phoneMatch || plateMatch)
                return res.status(400).json({ success: false, error: "Driver already exists" });
        }

        // Upload images
        const image1 = await uploadImage(req.files[0].buffer);
        const image2 = await uploadImage(req.files[1].buffer);

        // Encrypt fields
        const encryptedPhone = await encryptData(phone);
        const encryptedPlate = await encryptData(carPlate);
        const driverImage = image1;;
        const encryptedIdImage = await encryptData(image2);

        // Save
            // Save
const newDriver = new Driver({
    name,
    phone: encryptedPhone,
    plainPhone: phone,
    carPlate: encryptedPlate,
    plainPlate: carPlate,
    carType,
    driverImage: [image1] // store raw URL
});

            IdImage: [encryptedIdImage]
        

        await newDriver.save();
        return res.status(201).json({ success: true, message: "Driver registered successfully" });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, error: "Server error" });
    }
};

// LOGIN DRIVER
exports.loginDriver = async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) return res.status(400).json({ success: false, error: "Phone number required" });

        const drivers = await Driver.find();
        let loggedDriver = null;

        for (let d of drivers) {
            const isMatch = await bcrypt.compare(phone.toString(), d.phone);
            if (isMatch) {
                loggedDriver = d;
                break;
            }
        }

        if (!loggedDriver)
            return res.status(400).json({ success: false, error: "Phone number incorrect" });

        // CREATE SESSION
        req.session.user = {
            userId: loggedDriver._id,
            phone: loggedDriver.plainPhone
        };

        return res.status(200).json({
            success: true,
            driver: {
                name: loggedDriver.name,
                carType: loggedDriver.carType,
                carPlate: loggedDriver.plainPlate,
                session: req.session.user
            }
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, error: "Server error" });
    }
};
