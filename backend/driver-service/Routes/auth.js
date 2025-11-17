const express = require('express');
const router = express.Router();
const { registerDriver, loginDriver } = require("../controllers/auth.js");
const { uploadMiddleware } = require("../controllers/auth.js"); // 👈 import middleware

// Route for registering a driver with image upload
router.post("/register", uploadMiddleware, registerDriver);
router.post('/login', loginDriver )

module.exports = router;
