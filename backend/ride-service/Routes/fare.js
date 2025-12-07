const express = require('express');
const router = express.Router();

const {fare_Calculation} = require("../controllers/fare.js")
const matchController = require('../controllers/matchDriver.js');

router.post('/fare', fare_Calculation )

router.post('/match', matchController.matchDriverForRide);

module.exports= router