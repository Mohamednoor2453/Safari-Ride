// controllers/fare.js - Final Corrected Code

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

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
            userId // Now receiving userId
        } = req.body;

        // Basic validation
        if (!pickupLat || !destLat) {
            return res.status(400).json({ status: 'error', message: 'Missing coordinates.' });
        }

        const pickup = { lat: parseFloat(pickupLat), lng: parseFloat(pickupLng) };
        const destination = { lat: parseFloat(destLat), lng: parseFloat(destLng) };

        // Dynamic Surge logic would go here. Default is 1.0.
        const surgeMultiplier = 1.0;

        // Get official distance and duration from Google API
        const { distanceKm, timeMinutes } = await getDistanceAndTime(pickup, destination);

        // Calculate final fare
        const estimatedFare = calculateFare(distanceKm, timeMinutes, surgeMultiplier);

        // This ensures the fare is linked to the user's session ID (if stored/logged)
        console.log(`Fare calculated for User ID: ${userId}. Estimate: ${estimatedFare}`);

        // Send response
        return res.status(200).json({
            status: 'success',
            estimatedFare: estimatedFare,
            currency: 'KES',
            details: {
                distanceKm: distanceKm,
                timeMinutes: timeMinutes,
                surge: surgeMultiplier,
    destination: destinationName,
    destinationAddress
 }
});

 } catch (error) {
 console.error('Fare calculation failed:', error.message);

 return res.status(500).json({
 status: 'error',
 message: 'Unable to calculate fare. Please try again later.'
});
 }
};