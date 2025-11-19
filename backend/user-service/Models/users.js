const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  userPhoneNumber: {
    type: String,
    required: true,
    unique: true,
  },
  hashedPhone: {
    type: String,
    required: true,
  },
  // ✅ Track last verification timestamp for 7-day session
  lastVerifiedAt: {
    type: Date,
    default: null,
  },
});

module.exports = mongoose.model('User', userSchema);
