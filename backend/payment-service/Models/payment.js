// payment-service/models/Payment.js
const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
    // Ride Information
    rideId: { 
        type: String, 
        required: true,
        index: true
    },
    driverId: { 
        type: String, 
        required: true,
        index: true
    },
    driverName: { 
        type: String, 
        required: true 
    },
    userId: { 
        type: String, 
        required: true,
        index: true 
    },
    userPhone: { 
        type: String, 
        required: true 
    },
    
    // Payment Details
    amount: { 
        type: Number, 
        required: true,
        min: 1 // Minimum 1 KES
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
    
    // M-Pesa Specific Fields
    mpesaTransactionId: { 
        type: String, 
        sparse: true 
    },
    checkoutRequestID: { 
        type: String, 
        sparse: true,
        unique: true 
    },
    merchantRequestID: { 
        type: String, 
        sparse: true 
    },
    resultCode: { 
        type: Number 
    },
    resultDesc: { 
        type: String 
    },
    
    // Payment Status
    status: { 
        type: String, 
        enum: ["pending", "initiated", "processing", "completed", "failed", "cancelled"], 
        default: "pending" 
    },
    
    // Additional Info
    description: { 
        type: String, 
        default: "Safari Ride Payment" 
    },
    receiptNumber: { 
        type: String 
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
    timestamps: true // Adds createdAt and updatedAt
});

// Indexes for better query performance
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ userPhone: 1 });
paymentSchema.index({ driverId: 1, status: 1 });

// Virtual for formatted amount
paymentSchema.virtual('formattedAmount').get(function() {
    return `${this.amount.toLocaleString()} ${this.currency}`;
});

// Method to check if payment is successful
paymentSchema.methods.isSuccessful = function() {
    return this.status === "completed";
};

// Method to update status
paymentSchema.methods.updateStatus = async function(newStatus, additionalData = {}) {
    this.status = newStatus;
    
    // Set appropriate timestamp
    const now = new Date();
    if (newStatus === "completed") {
        this.completedAt = now;
    } else if (newStatus === "failed") {
        this.failedAt = now;
    } else if (newStatus === "initiated") {
        this.initiatedAt = now;
    }
    
    // Update additional fields if provided
    Object.assign(this, additionalData);
    
    return this.save();
};

const Payment = mongoose.model("Payment", paymentSchema);
module.exports = Payment;