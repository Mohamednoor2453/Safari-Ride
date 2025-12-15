// backend/shared/models/RideDetails.js
const mongoose = require("mongoose");

const rideDetailsSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    userPhone: { type: String, required: true },

    pickupCoordinates: {
        type: { lat: Number, lng: Number },
        required: true
    },

    destinationCoordinates: {
        type: { lat: Number, lng: Number },
        required: true
    },

    destinationName: { type: String, required: true },
    destinationAddress: { type: String, required: true },

    distance: { type: Number, required: true },
    time: { type: Number, required: true },
    fare: { type: Number, required: true },

    status: {
        type: String,
        enum: ["searching", "driver_assigned", "in_progress", "completed", "cancelled", "search_failed"],
        default: "searching"
    },

    assignedDriver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", default: null },

    driverInfo: {
        name: String,
        phone: String,
        carPlate: String,
        carType: String
    },

    cancellationReason: {
        type: String,
        enum: ["user_cancelled", "driver_cancelled", "system_cancelled", "timeout"],
        default: null
    },

    startedAt: {
        type: Date,
        default: null
    },

    completedAt: {
        type: Date,
        default: null
    },

    cancelledAt: {
        type: Date,
        default: null
    },

    attempts: { type: Array, default: [] }
}, { timestamps: true });

module.exports = mongoose.models.RideDetails || mongoose.model("RideDetails", rideDetailsSchema);