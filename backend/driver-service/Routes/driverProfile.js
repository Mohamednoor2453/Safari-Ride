const express = require('express');
const router = express.Router();

const {getDriverProfile}= require("../controllers/driverProfile.js")
const isAuthenticated=require("../Middleware/authMiddleware.js")

//routes for driver profile
router.get("/driverProfile", isAuthenticated, getDriverProfile)

module.exports = router