// controllers/fare.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const RideDetails = require("../models/rideDetails");
const { calculateFare, getDistanceAndTime } = require('./fareCalculation.js');

exports.fare_Calculation = async (req, res) => {
    try {
        const {
            pickupLat,
            pickupLng,
            destLat,
            destLng,
            destinationName,
            destinationAddress,
            userId,
            userPhone
        } = req.body;

        if (!pickupLat || !destLat) {
            return res.status(400).json({ status: "error", message: "Missing coordinates" });
        }

        const pickup = { lat: parseFloat(pickupLat), lng: parseFloat(pickupLng) };
        const destination = { lat: parseFloat(destLat), lng: parseFloat(destLng) };

        const { distanceKm, timeMinutes } = await getDistanceAndTime(pickup, destination);

        const surgeMultiplier = 1.0;
        const estimatedFare = calculateFare(distanceKm, timeMinutes, surgeMultiplier);

        // ⭐ SAVE RIDE REQUEST IN DATABASE ⭐
        const ride = await RideDetails.create({
            userId,
            userPhone,
            pickupCoordinates: pickup,
            destinationCoordinates: destination,
            destinationName,
            destinationAddress,
            distance: distanceKm,
            time: timeMinutes,
            fare: estimatedFare,
            status: "searching"
        });

        console.log(`Ride created: ${ride._id} for User: ${userId}`);

        return res.status(200).json({
            status: "success",
            rideId: ride._id,
            estimatedFare,
            currency: "KES",
            details: {
                distanceKm,
                timeMinutes,
                surge: surgeMultiplier,
                destinationName,
                destinationAddress
            }
        });

    } catch (error) {
        console.error("Fare calculation failed:", error);
        return res.status(500).json({
            status: "error",
            message: "Unable to calculate fare or save ride."
        });
    }
};
