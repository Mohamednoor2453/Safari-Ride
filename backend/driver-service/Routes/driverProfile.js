const express = require('express');
const router = express.Router();

const {getDriverProfile, toggleOnlineStatus}= require("../controllers/driverProfile.js")
const isAuthenticated=require("../Middleware/authMiddleware.js")

//routes for driver profile
router.get("/driverProfile", isAuthenticated, getDriverProfile)
router.post('/toggleOnline', isAuthenticated, toggleOnlineStatus)

module.exports = router