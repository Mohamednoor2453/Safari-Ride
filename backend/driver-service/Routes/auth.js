// driver-service/Routes/auth.js - FIXED VERSION
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.js');

// Middleware for handling file uploads
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }
});

// Registration with file upload
router.post('/register', 
    upload.fields([
        { name: 'driverImage', maxCount: 1 },
        { name: 'idImage', maxCount: 1 }
    ]),
    async (req, res, next) => {
        // Check if files were uploaded
        if (!req.files || !req.files.driverImage || !req.files.idImage) {
            return res.status(400).json({
                success: false,
                error: 'Please upload both driver image and ID image'
            });
        }
        next();
    },
    authController.registerDriver
);

// Driver login
router.post('/login', authController.loginDriver);

// Driver logout
router.post('/logout', authController.logoutDriver);

// Get driver status
router.get('/status', authController.getDriverStatus);

// Test endpoint
router.get('/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Driver auth API is working',
        endpoints: {
            register: 'POST /api/register',
            login: 'POST /api/login',
            logout: 'POST /api/logout',
            status: 'GET /api/status'
        }
    });
});

module.exports = router;