// backend/shared/models/Driver.js
const mongoose = require("mongoose");

const driverSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  plainPhone: { type: String },
  carPlate: { type: String, required: true },
  plainPlate: { type: String },
  carType: { type: String, required: true },
  IdImage: [{ type: String }],
  driverImage: [{ type: String }],
  online: { type: Boolean, default: false },
  available: { type: Boolean, default: true },

  lastKnownLocation: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    updatedAt: { type: Date, default: Date.now },
  },

  resetToken: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.models.Driver || mongoose.model("Driver", driverSchema);