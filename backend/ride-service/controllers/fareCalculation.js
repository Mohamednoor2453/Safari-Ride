// fareCalculation.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const axios = require('axios');

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// Pricing model
const RATES = {
    BASE_FARE: 120,
    RATE_PER_KM: 44,
    RATE_PER_MINUTE: 7.20,
    MINIMUM_FARE: 180.00
};

// Calculate final fare
function calculateFare(distanceKm, timeMinutes, surgeMultiplier = 1.0) {
    const distanceCost = distanceKm * RATES.RATE_PER_KM;
    const timeCost = timeMinutes * RATES.RATE_PER_MINUTE;

    let subtotal = RATES.BASE_FARE + distanceCost + timeCost;
    subtotal *= surgeMultiplier;

    const finalFare = Math.max(subtotal, RATES.MINIMUM_FARE);

    return parseFloat(finalFare.toFixed(2));
}

// Call Google Distance Matrix API
async function getDistanceAndTime(origin, destination) {
    const url = 'https://maps.googleapis.com/maps/api/distancematrix/json';

    const origins = `${origin.lat},${origin.lng}`;
    const destinations = `${destination.lat},${destination.lng}`;

    try {
        console.log('Calling Distance Matrix API with:', origins, destinations);

        const response = await axios.get(url, {
            params: {
                origins,
                destinations,
                key: GOOGLE_API_KEY,
                units: 'metric'
            }
        });

        const data = response.data;
        console.log('Distance Matrix API response:', JSON.stringify(data, null, 2));

        if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
            const element = data.rows[0].elements[0];

            const distanceKm = element.distance.value / 1000; // meters → km
            const timeMinutes = element.duration.value / 60;  // seconds → minutes

            return { distanceKm, timeMinutes };
        }

        throw new Error(`Distance Matrix element status: ${data.rows[0].elements[0].status}`);
    } catch (error) {
        console.error('Geospatial API Error:', error.message);
        throw new Error('Failed to retrieve distance and time data.');
    }
}

module.exports = {
    calculateFare,
    getDistanceAndTime
};
