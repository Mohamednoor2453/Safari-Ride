// backend/ride-service/Routes/fare.js
const express = require('express');
const router = express.Router();
const FareController = require('../controllers/fare.js');
const MatchDriverController = require('../controllers/matchDriver.js');

// Calculate fare and create ride
router.post('/fare', FareController.fare_Calculation);

// Match driver for ride
router.post('/match', MatchDriverController.matchDriverForRide);

module.exports = router;