const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true }, // encrypted
    plainPhone: { type: String, required: true },

    carPlate: { type: String, required: true }, // encrypted
    plainPlate: { type: String, required: true },

    carType: { type: String, required: true },

    IdImage: { type: [String], required: true },
    driverImage: { type: [String], required: true },

    resetToken: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Driver', driverSchema);
