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
        enum: ["searching", "driver_assigned", "search_failed", "cancelled"],
        default: "searching"
    },

    assignedDriver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", default: null },

    driverInfo: {
        name: String,
        phone: String,
        carPlate: String,
        carType: String
    },

    attempts: { type: Array, default: [] }
}, { timestamps: true });

module.exports = mongoose.models.RideDetails || mongoose.model("RideDetails", rideDetailsSchema);
