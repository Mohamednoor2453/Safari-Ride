const express = require('express');
const router = express.Router();

const paymentController = require("../controllers/managePayments.js")


//get completed or successful payments

router.get('/payments', paymentController.getPaymentDetails)


module.exports = router;