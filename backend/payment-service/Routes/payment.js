// payment-service/routes/paymentRoutes.js - COMPLETE FIXED VERSION
const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment.js");

// Request validation middleware
const validateMpesaRequest = (req, res, next) => {
    const { rideId, userPhone, amount, driverId, driverName } = req.body;
    
    if (!rideId || !userPhone || !amount || !driverId || !driverName) {
        return res.status(400).json({
            success: false,
            error: "Missing required fields: rideId, userPhone, amount, driverId, driverName",
            timestamp: new Date().toISOString()
        });
    }
    
    if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({
            success: false,
            error: "Amount must be a positive number",
            timestamp: new Date().toISOString()
        });
    }
    
    next();
};

const validateCashRequest = (req, res, next) => {
    const { rideId, amount, driverId, driverName } = req.body;
    
    if (!rideId || !amount || !driverId || !driverName) {
        return res.status(400).json({
            success: false,
            error: "Missing required fields: rideId, amount, driverId, driverName",
            timestamp: new Date().toISOString()
        });
    }
    
    next();
};

// Rate limiting middleware (simplified)
const rateLimiter = (req, res, next) => {
    // In production, use a proper rate limiter like express-rate-limit
    next();
};

// Payment Routes
router.post("/mpesa/stk-push", 
    rateLimiter,
    validateMpesaRequest,
    paymentController.initiateMpesaPayment
);

router.post("/mpesa/callback", 
    paymentController.mpesaCallback
);

router.post("/cash",
    rateLimiter,
    validateCashRequest,
    paymentController.processCashPayment
);

router.get("/status",
    paymentController.getPaymentStatus
);

router.get("/driver/:driverId/payments",
    paymentController.getDriverPayments
);

// Health checks
router.get("/health", 
    paymentController.healthCheck
);

router.get("/db-health", 
    paymentController.dbHealthCheck
);

// Test endpoint
router.get("/test", (req, res) => {
    res.json({
        success: true,
        message: "Payment service is running",
        timestamp: new Date().toISOString(),
        endpoints: {
            mpesaStkPush: "POST /api/payments/mpesa/stk-push",
            mpesaCallback: "POST /api/payments/mpesa/callback",
            cashPayment: "POST /api/payments/cash",
            paymentStatus: "GET /api/payments/status",
            driverPayments: "GET /api/payments/driver/:driverId/payments",
            health: "GET /api/payments/health",
            dbHealth: "GET /api/payments/db-health",
            test: "GET /api/payments/test"
        }
    });
});

module.exports = router;