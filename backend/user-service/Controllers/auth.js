const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const User = require('../Models/users');
const OTP = require('../Models/Otp');

const Africastalking = require('africastalking')({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME,
});
const sms = Africastalking.SMS;

// ✅ Regex to verify phone number
const phoneRegex = /^(?:\+254|0)[17]\d{8}$/;

// ✅ Generate OTP
function generateOTP(length = 6) {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

// ✅ Normalize phone number to +254
function formatPhoneNumber(phone) {
  let formatted = phone.toString().trim();
  if (formatted.startsWith('0')) {
    formatted = '+254' + formatted.slice(1);
  }
  return formatted;
}



  // ✅ Send SMS with retry for InvalidSenderId
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
        const msg = response?.SMSMessageData?.Message || '';
        console.log('✅ Message successfully sent:', msg);

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
        // Retry after 2s if any error occurs
        setTimeout(() => sendMessage(phone, otp), 2000);
      });
  };

  sendSMS();
}

// ------------------- LOGIN OR REGISTER -------------------
exports.loginOrRegister = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ message: 'Invalid phone number format' });
    }

    const formattedPhone = formatPhoneNumber(phone);
    let existingUser = await User.findOne({ userPhoneNumber: formattedPhone });

    const now = new Date();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

    if (!existingUser) {
      // New user → create and send OTP
      const hashedPhone = await bcrypt.hash(formattedPhone, 10);
      existingUser = await User.create({
        userPhoneNumber: formattedPhone,
        hashedPhone,
        lastVerifiedAt: null,
      });
    } else {
      const isSame = await bcrypt.compare(formattedPhone, existingUser.hashedPhone);
      if (!isSame) {
        return res.status(400).json({ message: 'Phone number does not match records' });
      }

      // ✅ Check lastVerifiedAt
      if (existingUser.lastVerifiedAt && (now - existingUser.lastVerifiedAt) < SEVEN_DAYS) {
        return res.status(200).json({
          message: 'User already verified',
          phone: formattedPhone,
          redirect: '/allowLocation',
        });
      }
    }

    // ✅ If not verified or expired → send OTP
    await OTP.deleteMany({ userPhoneNumber: formattedPhone });
    const otp = generateOTP();
    await OTP.create({ userPhoneNumber: formattedPhone, otp });

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

// ------------------- VERIFY OTP -------------------
exports.verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ message: 'Phone number and OTP are required' });
    }

    const formattedPhone = phone.startsWith('+254')
      ? phone
      : phone.startsWith('0')
      ? '+254' + phone.slice(1)
      : '+254' + phone.slice(-9);

    const otpRecord = await OTP.findOne({ userPhoneNumber: formattedPhone });
    if (!otpRecord) {
      return res.status(400).json({ message: 'OTP not found or expired' });
    }

    if (otpRecord.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }

    // ✅ Delete OTP after success
    await OTP.deleteOne({ _id: otpRecord._id });

    // ✅ Update lastVerifiedAt for 7-day persistence
    await User.updateOne(
      { userPhoneNumber: formattedPhone },
      { lastVerifiedAt: new Date() }
    );

    // 🔐 ADMIN CHECK
    const adminPhone = '+254' + process.env.ADMIN_PHONE.replace(/^0+/, '');
    let redirectPage = '/allowLocation';

    if (formattedPhone === adminPhone) {
      redirectPage = '/admin';
    }

    res.status(200).json({
      message: 'OTP verified successfully',
      phone: formattedPhone,
      success: true,
      redirect: redirectPage,
    });

  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
