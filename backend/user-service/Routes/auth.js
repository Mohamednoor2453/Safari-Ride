// user-service/routes/auth.js - SIMPLE VERSION (if you don't need test endpoints)
const express = require('express');
const router = express.Router();
const { 
  loginOrRegister, 
  verifyOtp, 
  validateUser
} = require('../Controllers/auth.js');

// Only essential routes
router.post('/login', loginOrRegister);
router.post('/verify-otp', verifyOtp);
router.post('/validate', validateUser);

module.exports = router;