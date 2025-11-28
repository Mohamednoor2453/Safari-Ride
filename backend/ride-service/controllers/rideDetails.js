const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const RideDetails = require("../Models/rideDetails.js")
const User = require("../../user-service/Models/users.js");

exports.RideDetails = async (req, res)=>{
    try {
        const {
            userId,
            
        } = req.body;
    } catch (error) {
        
    }
}
