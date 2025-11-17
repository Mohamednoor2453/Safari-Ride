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
});

module.exports = mongoose.model('User', userSchema);
