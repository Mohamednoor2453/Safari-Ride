const mongoose = require("mongoose");

const rideDetailsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    userPhone: {
        type: String,
        required: true
    },

    pickupCoordinates: {
        type: {
            lat: Number,
            lng: Number
        },
        required: true
    },

    destinationCoordinates: {
        type: {
            lat: Number,
            lng: Number
        },
        required: true
    },

    destinationName: {
        type: String,
        required: true
    },

    destinationAddress: {
        type: String,
        required: true
    },

    distance: {
        type: Number,
        required: true
    },

    time: {
        type: Number,
        required: true
    },

    fare: {
        type: Number,
        required: true
    },

    status: {
        type: String,
        enum: ["searching", "driver_assigned", "on_trip", "completed", "cancelled"],
        default: "searching"
    }
},
{ timestamps: true });

module.exports = mongoose.model("RideDetails", rideDetailsSchema);
