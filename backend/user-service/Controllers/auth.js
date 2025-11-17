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

// ✅ Regex to verify phone number (accepts 07xxxxxxxx or +2547xxxxxxxx)
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

// ✅ Helper to normalize phone to +254 format
function formatPhoneNumber(phone) {
  let formatted = phone.toString().trim();
  if (formatted.startsWith('0')) {
    formatted = '+254' + formatted.slice(1);
  }
  return formatted;
}

// ✅ Send SMS
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
        setTimeout(() => sendMessage(phone, otp), 2000);
      });
  };

  sendSMS();
}

// ✅ Login or Register Controller
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

// ✅ Verify OTP Controller
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

    await OTP.deleteOne({ _id: otpRecord._id });

    // 🔐 ADMIN CHECK
    const adminPhone = '+254' + process.env.ADMIN_PHONE.replace(/^0+/, '');
    let redirectPage = '/allowLocation'; // default for users/drivers

    if (formattedPhone === adminPhone) {
      redirectPage = '/admin';
      console.log('👑 Admin login detected, redirecting to admin panel...');
    }

    console.log('formattedPhone:', formattedPhone);
    console.log('adminPhone:', adminPhone);
    console.log('redirectPage:', redirectPage);

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
