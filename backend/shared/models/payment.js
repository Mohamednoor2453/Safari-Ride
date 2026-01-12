const mongoose = require("mongoose");

// Simplified payment schema without complex validation that might cause timeout
const paymentSchema = new mongoose.Schema({
  // Core fields
  rideId: { 
    type: String, 
    required: true,
    trim: true
  },
  driverId: { 
    type: String, 
    required: true,
    trim: true
  },
  driverName: { 
    type: String, 
    required: true,
    trim: true
  },
  userId: { 
    type: String, 
    trim: true
  },
  userPhone: { 
    type: String, 
    required: true,
    trim: true
  },
  
  // Payment details
  amount: { 
    type: Number, 
    required: true,
    min: 1
  },
  currency: { 
    type: String, 
    default: "KES"
  },
  paymentMethod: { 
    type: String, 
    enum: ["mpesa", "cash", "card"], 
    required: true
  },
  
  // M-Pesa specific fields
  mpesaTransactionId: { 
    type: String,
    trim: true
  },
  checkoutRequestID: { 
    type: String,
    trim: true
  },
  merchantRequestID: { 
    type: String,
    trim: true
  },
  resultCode: { 
    type: Number 
  },
  resultDesc: { 
    type: String 
  },
  
  // Status
  status: { 
    type: String, 
    enum: ["pending", "initiated", "processing", "completed", "failed", "cancelled"], 
    default: "pending"
  },
  
  description: { 
    type: String, 
    default: "Safari Ride Payment",
    trim: true
  },
  
  // Timestamps
  initiatedAt: { 
    type: Date 
  },
  completedAt: { 
    type: Date 
  },
  failedAt: { 
    type: Date 
  }
}, {
  timestamps: true,
  collection: "payments",
  // Disable version key to reduce overhead
  versionKey: false,
  // Disable automatic index creation - we'll create them manually in db.js
  autoIndex: false
});

// REMOVED the manual index creation lines to prevent duplicates:
// paymentSchema.index({ rideId: 1 });
// paymentSchema.index({ checkoutRequestID: 1 });
// paymentSchema.index({ status: 1 });

// Simplified static methods
paymentSchema.statics.findByCheckoutRequest = function(checkoutRequestID) {
  return this.findOne({ checkoutRequestID });
};

paymentSchema.statics.findByRideId = function(rideId) {
  return this.findOne({ rideId });
};

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;