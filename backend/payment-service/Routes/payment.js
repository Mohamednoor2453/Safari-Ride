const express = require("express");
const router = express.Router();
const paymentController = require("../Controllers/payment.js");

// --------------------
// Middlewares
// --------------------
const validateMpesaRequest = (req, res, next) => {
  const { rideId, userPhone, amount, driverId, driverName } = req.body;

  if (!rideId || !userPhone || !amount || !driverId || !driverName) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields",
      required: ["rideId", "userPhone", "amount", "driverId", "driverName"]
    });
  }

  next();
};

// Database readiness middleware
const checkDBReady = async (req, res, next) => {
  const { mongoose } = require("../../shared/db");
  
  if (mongoose.connection && mongoose.connection.readyState !== 1) {
    console.warn("⚠️ Database not ready, request will use memory fallback");
    req.dbReady = false;
  } else {
    req.dbReady = true;
  }
  
  // Attach DB info to response locals for logging
  res.locals.dbReady = req.dbReady;
  res.locals.dbState = mongoose.connection ? mongoose.connection.readyState : 0;
  
  next();
};

// Log response middleware
const logResponse = (req, res, next) => {
  const oldJson = res.json;
  res.json = function(data) {
    console.log(`📤 Response for ${req.method} ${req.path}:`, {
      success: data.success,
      statusCode: res.statusCode,
      dbReady: res.locals.dbReady,
      dbState: res.locals.dbState,
      timestamp: new Date().toISOString()
    });
    return oldJson.call(this, data);
  };
  next();
};

// Apply middleware to all payment routes
router.use(checkDBReady);
router.use(logResponse);

// 🎯 MPESA PAYMENT (STK Push)
router.post(
  "/mpesa",
  validateMpesaRequest,
  paymentController.initiateMpesaPayment
);

// 🎯 MPESA CALLBACK
router.post(
  "/mpesa/callback",
  paymentController.mpesaCallback
);

// 🎯 CASH PAYMENT
router.post(
  "/cash",
  paymentController.processCashPayment
);

// 🎯 GET PAYMENT STATUS
router.get(
  "/status",
  paymentController.getPaymentStatus
);

// 🎯 SIMULATE PAYMENT (FOR TESTING)
router.post(
  "/simulate",
  paymentController.simulatePaymentCompletion
);

// 🎯 HEALTH CHECK
router.get(
  "/health",
  paymentController.healthCheck
);

// 🎯 FIX PAYMENT STATUS
router.post(
  "/fix",
  paymentController.fixPaymentStatus
);

// 🎯 MEMORY PAYMENTS ENDPOINT (for debugging)
router.get("/memory", (req, res) => {
  const memoryPayments = global.inMemoryPayments || [];
  const unsynced = memoryPayments.filter(p => !p._syncedToDB);
  const synced = memoryPayments.filter(p => p._syncedToDB);
  
  res.json({
    success: true,
    count: memoryPayments.length,
    unsynced: unsynced.length,
    synced: synced.length,
    payments: memoryPayments.slice(0, 10).map(p => ({
      _id: p._id,
      rideId: p.rideId,
      amount: p.amount,
      status: p.status,
      checkoutRequestID: p.checkoutRequestID,
      synced: p._syncedToDB,
      createdAt: p.createdAt
    }))
  });
});

// 🎯 SYNC ENDPOINT (manual trigger)
router.post("/sync", async (req, res) => {
  try {
    if (global.syncMemoryPaymentsToDB) {
      console.log("🔄 Manual sync triggered");
      await global.syncMemoryPaymentsToDB();
      res.json({
        success: true,
        message: "Sync triggered",
        memoryCount: global.inMemoryPayments ? global.inMemoryPayments.length : 0
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Sync function not available"
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 🎯 TEST ENDPOINT
router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Payment Service API is working!",
    timestamp: new Date().toISOString(),
    dbReady: req.dbReady,
    note: "Use /simulate endpoint to test payment completion without M-Pesa"
  });
});

module.exports = router;