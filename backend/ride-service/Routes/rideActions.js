// backend/ride-service/Routes/rideActions.js
const express = require('express');
const router = express.Router();
const RideDetails = require("../../shared/models/RideDetails.js");

// Cancel ride
router.post('/cancel', async (req, res) => {
  try {
    const { rideId, reason } = req.body;
    
    if (!rideId) {
      return res.status(400).json({ success: false, message: 'Ride ID is required' });
    }

    const cancelRide = req.app.get('cancelRide');
    const cancelled = await cancelRide(rideId, reason || 'user_cancelled');

    if (cancelled) {
      return res.status(200).json({ 
        success: true, 
        message: 'Ride cancelled successfully' 
      });
    } else {
      return res.status(404).json({ 
        success: false, 
        message: 'Ride not found or already cancelled' 
      });
    }
  } catch (error) {
    console.error('❌ Cancel ride error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Start ride
router.post('/start', async (req, res) => {
  try {
    const { rideId, driverId } = req.body;
    
    if (!rideId || !driverId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ride ID and Driver ID are required' 
      });
    }

    const startRide = req.app.get('startRide');
    const started = await startRide(rideId, driverId);

    if (started) {
      return res.status(200).json({ 
        success: true, 
        message: 'Ride started successfully' 
      });
    } else {
      return res.status(404).json({ 
        success: false, 
        message: 'Ride not found or cannot be started' 
      });
    }
  } catch (error) {
    console.error('❌ Start ride error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// End ride
router.post('/end', async (req, res) => {
  try {
    const { rideId, driverId } = req.body;
    
    if (!rideId || !driverId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ride ID and Driver ID are required' 
      });
    }

    const endRide = req.app.get('endRide');
    const ended = await endRide(rideId, driverId);

    if (ended) {
      return res.status(200).json({ 
        success: true, 
        message: 'Ride completed successfully' 
      });
    } else {
      return res.status(404).json({ 
        success: false, 
        message: 'Ride not found or cannot be completed' 
      });
    }
  } catch (error) {
    console.error('❌ End ride error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get ride status
router.get('/status/:rideId', async (req, res) => {
  try {
    const { rideId } = req.params;
    
    const ride = await RideDetails.findById(rideId);
    if (!ride) {
      return res.status(404).json({ success: false, message: 'Ride not found' });
    }

    return res.status(200).json({
      success: true,
      ride: {
        _id: ride._id,
        status: ride.status,
        driverInfo: ride.driverInfo,
        fare: ride.fare,
        pickupCoordinates: ride.pickupCoordinates,
        destinationCoordinates: ride.destinationCoordinates,
        destinationName: ride.destinationName,
        startedAt: ride.startedAt,
        completedAt: ride.completedAt,
        cancelledAt: ride.cancelledAt,
        cancellationReason: ride.cancellationReason
      }
    });
  } catch (error) {
    console.error('❌ Get ride status error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;