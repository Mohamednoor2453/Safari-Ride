const express = require('express');
const router = express.Router();
const { loginOrRegister, verifyOtp } = require('../Controllers/auth.js');

router.post('/login', loginOrRegister);
router.post('/verify-otp', verifyOtp );

module.exports = router;
