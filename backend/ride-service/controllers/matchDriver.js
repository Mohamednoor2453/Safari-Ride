// backend/ride-service/controllers/matchDriver.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require("mongoose");

const RideDetails = require("../../shared/models/RideDetails.js");
const Driver = require("../../shared/models/Driver.js");

// Haversine distance in meters
function haversineDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Number.MAX_SAFE_INTEGER;
  
  function toRad(x) { return x * Math.PI / 180; }
  const R = 6371e3;
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);
  const a = Math.sin(Δφ/2)**2 +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

exports.matchDriverForRide = async (req, res) => {
  try {
    const io = req.app.get('io');
    const driverSockets = req.app.get('driverSockets');
    const waitForDriverResponse = req.app.get('waitForDriverResponse');

    const { rideId } = req.body;
    if (!rideId) return res.status(400).json({ success: false, message: 'Missing rideId' });

    const ride = await RideDetails.findById(rideId);
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });

    if (ride.status === 'driver_assigned') {
      return res.status(400).json({ success: false, message: 'Driver already assigned' });
    }

    // Update ride status to searching
    ride.status = 'searching';
    await ride.save();

    // Notify user that search has started
    io.emit('ride_update', {
      rideId: ride._id.toString(),
      status: 'searching',
      message: 'Searching for available drivers...'
    });

    // Fetch online and available drivers
    const drivers = await Driver.find({ online: true, available: true }).lean();
    console.log(`Found ${drivers.length} online drivers`);

    if (!drivers.length) {
      ride.status = 'search_failed';
      await ride.save();
      
      // Notify user
      io.emit('ride_update', {
        rideId: ride._id.toString(),
        status: 'search_failed',
        message: 'No drivers available at the moment.'
      });
      
      return res.status(200).json({ success: false, message: 'No drivers available' });
    }

    // Compute distances from pickup - WITH FALLBACK FOR MISSING LOCATIONS
    const pickup = ride.pickupCoordinates;
    const sortedDrivers = drivers
      .map(d => {
        const loc = d.lastKnownLocation || {};
        const lat = loc.lat;
        const lng = loc.lng;
        
        // If driver has no location, give them a high but not infinite distance
        if (!lat || !lng) {
          return { 
            driver: d, 
            distanceMeters: 100000, // 100km default for drivers without location
            distanceKm: 100,
            hasLocation: false 
          };
        }
        
        const distanceMeters = haversineDistance(pickup.lat, pickup.lng, lat, lng);
        return { 
          driver: d, 
          distanceMeters, 
          distanceKm: (distanceMeters / 1000).toFixed(2),
          hasLocation: true 
        };
      })
      .filter(d => d.distanceMeters <= 500000) // Increased to 500km to include all drivers
      .sort((a, b) => {
        // Prioritize drivers with actual locations
        if (a.hasLocation && !b.hasLocation) return -1;
        if (!a.hasLocation && b.hasLocation) return 1;
        return a.distanceMeters - b.distanceMeters;
      });

    console.log(`After filtering: ${sortedDrivers.length} drivers available`);
    
    if (sortedDrivers.length > 0) {
      console.log('Driver distances:', sortedDrivers.map(d => ({
        id: d.driver._id.toString().substring(0, 8),
        distance: d.distanceKm + 'km',
        hasLocation: d.hasLocation
      })));
    }

    if (sortedDrivers.length === 0) {
      ride.status = 'search_failed';
      await ride.save();
      
      io.emit('ride_update', {
        rideId: ride._id.toString(),
        status: 'search_failed',
        message: 'No drivers available in your area.'
      });
      
      return res.status(200).json({ success: false, message: 'No drivers available in your area.' });
    }

    const REQUEST_TIMEOUT_MS = 25000; // 25 seconds timeout
    const attempts = [];
    let assigned = null;

    // Try each driver in order
    for (const entry of sortedDrivers) {
      const d = entry.driver;
      const driverId = d._id.toString();
      
      console.log(`Requesting ride from driver ${driverId} (${entry.distanceKm} km away, hasLocation: ${entry.hasLocation})`);
      
      attempts.push({ 
        driverId, 
        distanceMeters: entry.distanceMeters, 
        distanceKm: entry.distanceKm,
        hasLocation: entry.hasLocation,
        time: new Date() 
      });

      const sock = driverSockets.get(driverId);
      if (!sock) {
        console.log(`Driver ${driverId} has no active socket, skipping`);
        continue;
      }

      // Prepare ride request payload
      const requestPayload = {
        rideId: ride._id.toString(),
        pickup: ride.pickupCoordinates,
        destination: ride.destinationCoordinates,
        userPhone: ride.userPhone,
        userId: ride.userId?.toString() || null,
        destinationName: ride.destinationName,
        destinationAddress: ride.destinationAddress,
        fare: ride.fare,
        distance: ride.distance,
        time: ride.time,
        timestamp: new Date().toISOString()
      };

      // Send ride request to driver
      sock.emit('ride_request', requestPayload);
      console.log(`✓ Sent ride_request to driver ${driverId}`);

      try {
        // Wait for driver response with timeout using the new helper
        const response = await Promise.race([
          waitForDriverResponse(ride._id.toString(), driverId, REQUEST_TIMEOUT_MS),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('timeout')), REQUEST_TIMEOUT_MS)
          )
        ]);

        if (response && response.accepted) {
          assigned = { driverId, info: response.info || d };
          console.log(`Driver ${driverId} accepted the ride!`, response.info);

          // Update ride with driver assignment
          ride.status = 'driver_assigned';
          ride.assignedDriver = new mongoose.Types.ObjectId(driverId);
          ride.driverInfo = {
            name: response.info?.name || d.name,
            phone: response.info?.phone || d.plainPhone,
            carPlate: response.info?.carPlate || d.plainPlate,
            carType: response.info?.carType || d.carType
          };
          ride.attempts = attempts;
          await ride.save();

          // Notify driver
          sock.emit('ride_confirmed_to_driver', { 
            rideId: ride._id.toString(), 
            userPhone: ride.userPhone, 
            destination: ride.destinationName,
            pickup: ride.pickupCoordinates,
            fare: ride.fare
          });

          // Notify user
          io.emit('ride_update', {
            rideId: ride._id.toString(),
            status: 'driver_assigned',
            driver: ride.driverInfo,
            message: 'Driver accepted. On the way.'
          });

          break;
        } else {
          console.log(`Driver ${driverId} declined`);
        }
      } catch (error) {
        console.log(`✗ Driver ${driverId} request timed out or error:`, error.message);
      }
    }

    if (!assigned) {
      console.log('No drivers accepted the ride');
      ride.status = 'search_failed';
      ride.attempts = attempts;
      await ride.save();
      
      io.emit('ride_update', {
        rideId: ride._id.toString(),
        status: 'search_failed',
        message: 'No drivers accepted the ride request.'
      });
      
      return res.status(200).json({ success: false, message: 'No drivers accepted the ride.' });
    }

    console.log(`✅ Ride ${rideId} successfully assigned to driver ${assigned.driverId}`);
    return res.status(200).json({ 
      success: true, 
      message: 'Driver assigned', 
      rideId: ride._id.toString(),
      driver: assigned.info 
    });

  } catch (error) {
    console.error('❌ matchDriverForRide error', error);
    
    // Update ride status to failed if there was an error
    try {
      const ride = await RideDetails.findById(req.body.rideId);
      if (ride) {
        ride.status = 'search_failed';
        await ride.save();
      }
    } catch (e) {
      console.error('Error updating ride status:', e);
    }
    
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};