// controllers/fare.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const RideDetails = require("../../shared/models/RideDetails");
const mongoose = require('mongoose');
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

        console.log('📥 Fare calculation request received:', {
            pickupLat,
            pickupLng,
            destLat,
            destLng,
            destinationName,
            userId: userId ? `${userId.substring(0, 10)}...` : 'none',
            userPhone
        });

        if (!pickupLat || !destLat) {
            return res.status(400).json({ 
                status: "error", 
                message: "Missing coordinates" 
            });
        }

        const pickup = { 
            lat: parseFloat(pickupLat), 
            lng: parseFloat(pickupLng) 
        };
        const destination = { 
            lat: parseFloat(destLat), 
            lng: parseFloat(destLng) 
        };

        console.log('📍 Calculating distance and time...');
        const { distanceKm, timeMinutes } = await getDistanceAndTime(pickup, destination);
        console.log(`📏 Distance: ${distanceKm} km, Time: ${timeMinutes} mins`);

        const surgeMultiplier = 1.0;
        const estimatedFare = calculateFare(distanceKm, timeMinutes, surgeMultiplier);
        console.log(`💰 Estimated fare: ${estimatedFare} KES`);

        // ⭐ VALIDATE AND FIX USER ID ⭐
        let validUserId = userId;
        
        // Check if userId is a valid MongoDB ObjectId
        if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
            console.log(`⚠️ Invalid userId format: ${userId}, creating new ObjectId`);
            
            // If it's a temporary ID (starts with "temp_"), generate a new one
            if (userId.startsWith('temp_')) {
                validUserId = new mongoose.Types.ObjectId();
                console.log(`✅ Generated new ObjectId: ${validUserId}`);
            } else {
                // For other invalid formats, return error
                return res.status(400).json({
                    status: "error",
                    message: "Invalid user ID format. Please login again."
                });
            }
        }
        
        // If no userId provided, create a new one
        if (!validUserId) {
            validUserId = new mongoose.Types.ObjectId();
            console.log(`✅ Created new ObjectId for ride: ${validUserId}`);
        }

        console.log(`👤 Using User ID: ${validUserId}`);

        // ⭐ SAVE RIDE REQUEST IN DATABASE ⭐
        console.log('💾 Saving ride to database...');
        const ride = await RideDetails.create({
            userId: validUserId,
            userPhone: userPhone || 'Unknown',
            pickupCoordinates: pickup,
            destinationCoordinates: destination,
            destinationName: destinationName || 'Unknown Destination',
            destinationAddress: destinationAddress || 'Address not specified',
            distance: distanceKm,
            time: timeMinutes,
            fare: estimatedFare,
            status: "pending"
        });

        console.log(`✅ Ride created: ${ride._id} for User: ${validUserId}, Phone: ${userPhone || 'Unknown'}`);
        console.log(`📝 Ride Status: ${ride.status}`);

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
        console.error("❌ Fare calculation failed:", error);
        
        // More detailed error logging
        if (error.name === 'ValidationError') {
            console.error("🔍 Validation Error Details:");
            for (const field in error.errors) {
                console.error(`  - ${field}: ${error.errors[field].message}`);
            }
            return res.status(400).json({
                status: "error",
                message: `Validation failed: ${error.message}`,
                details: error.errors
            });
        }
        
        if (error.name === 'MongoError' || error.name === 'MongoServerError') {
            console.error("🔍 MongoDB Error:", error.message);
            return res.status(500).json({
                status: "error",
                message: "Database error occurred."
            });
        }
        
        console.error("🔍 Stack trace:", error.stack);
        return res.status(500).json({
            status: "error",
            message: "Unable to calculate fare or save ride."
        });
    }
};