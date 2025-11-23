const express = require('express');
const router = express.Router();

const {fare_Calculation} = require("../controllers/fare.js")

router.post('/fare', fare_Calculation )

module.exports= router