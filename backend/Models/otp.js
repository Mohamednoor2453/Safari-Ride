const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const otpSchema = new Schema({
  userPhoneNumber: {
    type: String,
    required: true,
  },
  otp: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 5, // expires after 5 minutes
  },
});

// ✅ Ensure TTL index is applied correctly
otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 300 });



module.exports = mongoose.model('Otp', otpSchema);
