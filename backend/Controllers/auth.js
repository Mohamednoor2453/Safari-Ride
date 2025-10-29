const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const User = require('../Models/users');
const OTP = require('../Models/Otp');

// 🔐 Africa's Talking Credentials
const Africastalking = require('africastalking')({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME,
});
const sms = Africastalking.SMS;

// ✅ Regex to verify phone number (accepts 07xxxxxxxx or +2547xxxxxxxx)
const phoneRegex = /^(?:\+254|0)[17]\d{8}$/;

// ✅ OTP Generator
function generateOTP(length = 6) {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

// ✅ Helper: Format phone number to +254 format
function formatPhoneNumber(phone) {
  let formatted = phone.toString().trim();
  if (formatted.startsWith('0')) {
    formatted = '+254' + formatted.slice(1);
  }
  return formatted;
}

// ✅ Send SMS Function with retry + auto-fallback for sandbox/live
function sendMessage(phone, otp) {
  const formattedPhone = phone.startsWith('+') ? phone : `+254${phone.slice(-9)}`;
  const fromValue = process.env.AT_ENV === 'sandbox' ? 'sandbox' : '';

  const options = {
    to: [formattedPhone],
    message: `Your Safari Ride OTP is ${otp}`,
    ...(fromValue && { from: fromValue }),
  };

  const sendSMS = () => {
    sms.send(options)
      .then(response => {
        const msg = response?.SMSMessageData?.Message || 'No message response';
        console.log('✅ Message successfully sent:', msg);

        // Handle InvalidSenderId automatically
        if (msg.includes('InvalidSenderId')) {
          console.warn('⚠️ InvalidSenderId detected — retrying without sender ID...');
          delete options.from;
          sms.send(options)
            .then(() => console.log('✅ Message resent successfully using default sender ID'))
            .catch(err => console.error('Error retrying SMS:', err.message || err));
        }
      })
      .catch(error => {
        console.error('Error sending message:', error.message || error);
        // Retry after 20 seconds
        setTimeout(() => sendMessage(phone, otp), 2000);
      });
  };

  sendSMS();
}

// ✅ Login or Register Controller (no OTP verify logic)
exports.loginOrRegister = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ message: 'Invalid phone number format' });
    }

    const formattedPhone = formatPhoneNumber(phone);

    let existingUser = await User.findOne({ userPhoneNumber: formattedPhone });

    if (!existingUser) {
      const hashedPhone = await bcrypt.hash(formattedPhone, 10);
      existingUser = await User.create({
        userPhoneNumber: formattedPhone,
        hashedPhone,
      });
      console.log('✅ New user registered:', formattedPhone);
    } else {
      const isSame = await bcrypt.compare(formattedPhone, existingUser.hashedPhone);
      if (!isSame) {
        return res.status(400).json({ message: 'Phone number does not match records' });
      }
    }

    // 🧹 Delete old OTPs for this user
    await OTP.deleteMany({ userPhoneNumber: formattedPhone });

    // 🔢 Generate and store new OTP
    const otp = generateOTP();
    await OTP.create({ userPhoneNumber: formattedPhone, otp });

    // 📩 Send SMS
    sendMessage(formattedPhone, otp);

    res.status(200).json({
      message: 'OTP sent successfully',
      phone: formattedPhone,
      redirect: '/otp',
    });
  } catch (error) {
    console.error('Error in login/register:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

//verify otp route
// Export the verifyOtp function so it can be used in your routes
exports.verifyOtp = async (req, res) => {
  try {
    //Extract phone and otp from the request body
    const { phone, otp } = req.body;

    //Check if both phone and otp exist
    if (!phone || !otp) {
      return res.status(400).json({ message: 'Phone number and OTP are required' });
    }

    //Format the phone number to always start with +254
    const formattedPhone = phone.startsWith('+254')
      ? phone                              // already formatted correctly
      : phone.startsWith('0')
      ? '+254' + phone.slice(1)            // change 07... → +2547...
      : '+254' + phone.slice(-9);          // handle cases like 745xxxxxx

    // Find the OTP record in the database using the formatted phone number
    const otpRecord = await OTP.findOne({ userPhoneNumber: formattedPhone });

    //  If OTP record does not exist, return error (expired or invalid)
    if (!otpRecord) {
      return res.status(400).json({ message: 'OTP not found or expired' });
    }

    //Compare the entered OTP with the one stored in the database
    if (otpRecord.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }

    //If OTP matches, delete it from the database (so it can’t be reused)
    await OTP.deleteOne({ _id: otpRecord._id });

    //Send success response back to frontend
    res.status(200).json({
      message: 'OTP verified successfully',
      phone: formattedPhone,
      success: true,
      redirect:'/allowLocation'
    });
  } catch (error) {
    
    console.error('Error verifying OTP:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
