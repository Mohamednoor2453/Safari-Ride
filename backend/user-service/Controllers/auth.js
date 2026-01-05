// user-service/controllers/auth.js - UPDATED FOR PROPER 7-DAY LOGIC
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const User = require('../Models/users');
const OTP = require('../Models/Otp');

// ✅ Initialize Africa's Talking (use this exact syntax)
const Africastalking = require('africastalking');
const atClient = Africastalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME,
});
const sms = atClient.SMS;

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

// ✅ Normalize phone number to +254 (FIXED VERSION)
function formatPhoneNumber(phone) {
  let formatted = phone.toString().trim();
  
  if (formatted.startsWith('0')) {
    formatted = '+254' + formatted.slice(1);
  } else if (formatted.startsWith('254')) {
    formatted = '+' + formatted;
  }
  // If it already starts with +254, leave it as is
  // If it's 9 digits (like 745827403), add +254
  else if (/^[17]\d{8}$/.test(formatted)) {
    formatted = '+254' + formatted;
  }
  
  return formatted;
}

// ✅ Send SMS with retry for InvalidSenderId (WORKING VERSION)
function sendMessage(phone, otp) {
  // Format phone number consistently
  const formattedPhone = phone.startsWith('+') ? phone : `+254${phone.slice(-9)}`;
  console.log(`📱 Sending OTP ${otp} to ${formattedPhone}`);
  
  const fromValue = process.env.AT_ENV === 'sandbox' ? 'sandbox' : '';

  const options = {
    to: [formattedPhone],
    message: `Your Safari Ride OTP is ${otp}. Valid for 5 minutes.`,
    ...(fromValue && { from: fromValue }),
  };

  console.log('📤 SMS Options:', {
    to: options.to,
    message: `OTP: ${otp}...`,
    from: options.from || 'Default'
  });

  const sendSMS = () => {
    sms.send(options)
      .then(response => {
        const msg = response?.SMSMessageData?.Message || '';
        console.log('✅ Message successfully sent:', msg);
        console.log('📊 Full response:', JSON.stringify(response, null, 2));

        if (msg.includes('InvalidSenderId')) {
          console.warn('⚠️ InvalidSenderId detected — retrying without sender ID...');
          delete options.from;
          sms.send(options)
            .then(() => console.log('✅ Message resent successfully using default sender ID'))
            .catch(err => console.error('Error retrying SMS:', err.message || err));
        }
      })
      .catch(error => {
        console.error('❌ Error sending message:', error.message || error);
        // Retry after 2s if any error occurs
        setTimeout(() => {
          console.log('🔄 Retrying SMS...');
          sendMessage(phone, otp);
        }, 2000);
      });
  };

  sendSMS();
}

// ✅ Check if phone is admin
function isAdminPhone(formattedPhone) {
  const adminPhoneFromEnv = process.env.ADMIN_PHONE || '0745827403';
  
  if (!adminPhoneFromEnv) {
    console.log('⚠️ ADMIN_PHONE not set in environment');
    return false;
  }
  
  // Normalize both numbers for comparison
  const normalizePhone = (phone) => {
    if (!phone) return '';
    phone = phone.toString().trim();
    if (phone.startsWith('0')) {
      return '+254' + phone.slice(1);
    } else if (phone.startsWith('254')) {
      return '+' + phone;
    } else if (phone.startsWith('+254')) {
      return phone;
    }
    // Assume it's 9 digits without country code (745827403)
    return '+254' + phone;
  };
  
  const normalizedUserPhone = normalizePhone(formattedPhone);
  const normalizedAdminPhone = normalizePhone(adminPhoneFromEnv);
  
  console.log('🔐 Admin Check:');
  console.log('  - User phone:', formattedPhone);
  console.log('  - Normalized user phone:', normalizedUserPhone);
  console.log('  - Admin phone from env:', adminPhoneFromEnv);
  console.log('  - Normalized admin phone:', normalizedAdminPhone);
  console.log('  - Is admin?', normalizedUserPhone === normalizedAdminPhone);
  
  return normalizedUserPhone === normalizedAdminPhone;
}

// ✅ Helper function to check if user is within 7-day grace period
function isWithinGracePeriod(lastVerifiedAt) {
  if (!lastVerifiedAt) return false;
  
  const now = new Date();
  const lastVerified = new Date(lastVerifiedAt);
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
  
  const timeDiff = now - lastVerified;
  const isWithinGracePeriod = timeDiff < SEVEN_DAYS;
  
  console.log(`⏰ Grace Period Check:`);
  console.log(`  - Last verified: ${lastVerified}`);
  console.log(`  - Current time: ${now}`);
  console.log(`  - Time difference: ${Math.floor(timeDiff / (1000 * 60 * 60 * 24))} days`);
  console.log(`  - Within 7 days? ${isWithinGracePeriod}`);
  
  return isWithinGracePeriod;
}

// ------------------- LOGIN OR REGISTER -------------------
exports.loginOrRegister = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ message: 'Invalid phone number format' });
    }

    const formattedPhone = formatPhoneNumber(phone);
    console.log(`📞 Processing login for: ${formattedPhone}`);
    
    let existingUser = await User.findOne({ userPhoneNumber: formattedPhone });

    // Check if this is admin
    let redirectPage = '/allowLocation';
    if (isAdminPhone(formattedPhone)) {
      redirectPage = '/admin';
      console.log('✅ Admin detected');
    }

    if (!existingUser) {
      // 🆕 NEW USER: Always ask for OTP
      console.log('👤 New user detected, always requiring OTP');
      
      // Create user (but don't set lastVerifiedAt yet)
      const hashedPhone = await bcrypt.hash(formattedPhone, 10);
      existingUser = await User.create({
        userPhoneNumber: formattedPhone,
        hashedPhone,
        lastVerifiedAt: null, // Will be set after OTP verification
      });
      console.log('👤 New user created with ID:', existingUser._id);
      
    } else {
      const isSame = await bcrypt.compare(formattedPhone, existingUser.hashedPhone);
      if (!isSame) {
        return res.status(400).json({ message: 'Phone number does not match records' });
      }

      // ✅ EXISTING USER: Check if within 7-day grace period
      if (isWithinGracePeriod(existingUser.lastVerifiedAt)) {
        // User is already verified within 7 days
        console.log('✅ User already verified within 7 days, skipping OTP');
        
        return res.status(200).json({
          message: 'User already verified',
          phone: formattedPhone,
          userId: existingUser._id, // Return actual MongoDB ID
          redirect: redirectPage
        });
      } else {
        console.log('⏰ 7-day grace period expired, asking for OTP');
      }
    }

    // ✅ If not verified or grace period expired → send OTP
    await OTP.deleteMany({ userPhoneNumber: formattedPhone });
    const otp = generateOTP();
    console.log(`🔑 Generated OTP: ${otp} for ${formattedPhone}`);
    
    await OTP.create({ userPhoneNumber: formattedPhone, otp });
    console.log('💾 OTP saved to database');

    // Send SMS
    sendMessage(formattedPhone, otp);

    res.status(200).json({
      message: 'OTP sent successfully',
      phone: formattedPhone,
      redirect: '/otp',
    });

  } catch (error) {
    console.error('❌ Error in login/register:', error);
    res.status(500).json({ 
      message: 'Internal Server Error',
      error: error.message 
    });
  }
};

// ------------------- VERIFY OTP -------------------
exports.verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ 
        success: false,
        message: 'Phone number and OTP are required' 
      });
    }

    console.log(`🔍 Verifying OTP ${otp} for ${phone}`);
    
    // Format phone number (same as sendMessage)
    const formattedPhone = phone.startsWith('+254')
      ? phone
      : phone.startsWith('0')
      ? '+254' + phone.slice(1)
      : '+254' + phone.slice(-9);

    const otpRecord = await OTP.findOne({ userPhoneNumber: formattedPhone });
    if (!otpRecord) {
      console.log(`❌ No OTP found for ${formattedPhone}`);
      return res.status(400).json({ 
        success: false,
        message: 'OTP not found or expired. Please request a new OTP.' 
      });
    }

    console.log(`🔑 Found OTP in DB: ${otpRecord.otp}`);
    
    if (otpRecord.otp !== otp) {
      console.log(`❌ OTP mismatch: Received ${otp}, Expected ${otpRecord.otp}`);
      return res.status(400).json({ 
        success: false,
        message: 'Invalid OTP. Please try again.' 
      });
    }

    // ✅ Delete OTP after success
    await OTP.deleteOne({ _id: otpRecord._id });
    console.log('✅ OTP verified and deleted from DB');

    // ✅ Get or create user
    let user = await User.findOne({ userPhoneNumber: formattedPhone });
    
    if (!user) {
      // Create user if doesn't exist
      const hashedPhone = await bcrypt.hash(formattedPhone, 10);
      user = await User.create({
        userPhoneNumber: formattedPhone,
        hashedPhone,
        lastVerifiedAt: new Date(), // Set verification timestamp
      });
      console.log('👤 New user created during OTP verification with ID:', user._id);
    } else {
      // Update lastVerifiedAt for 7-day persistence
      user.lastVerifiedAt = new Date();
      await user.save();
      console.log('👤 Existing user updated with verification timestamp');
      
      // Log when the next OTP will be required
      const nextVerificationDate = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000));
      console.log(`📅 Next OTP required after: ${nextVerificationDate.toLocaleString()}`);
    }

    // 🔐 ADMIN CHECK
    let redirectPage = '/allowLocation';
    
    // Check if this is admin
    if (isAdminPhone(formattedPhone)) {
      redirectPage = '/admin';
      console.log('✅ Admin detected in verifyOtp, redirecting to /admin');
    }

    // ✅ Return user data with proper MongoDB ID
    res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      phone: formattedPhone,
      userId: user._id.toString(), // Return as string
      userData: {
        _id: user._id.toString(),
        phone: formattedPhone,
        verified: true,
        lastVerifiedAt: user.lastVerifiedAt,
        nextVerification: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString()
      },
      redirect: redirectPage
    });

  } catch (error) {
    console.error('❌ Error verifying OTP:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal Server Error',
      error: error.message 
    });
  }
};

// ------------------- VALIDATE USER -------------------
exports.validateUser = async (req, res) => {
  try {
    const { phone, userId } = req.body;

    if (!phone) {
      return res.status(400).json({ 
        success: false, 
        error: "Phone number is required" 
      });
    }

    const formattedPhone = formatPhoneNumber(phone);
    const user = await User.findOne({ userPhoneNumber: formattedPhone });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: "User not found" 
      });
    }

    // If userId was provided and it's a temporary ID, replace it with the real one
    let validUserId = user._id.toString();
    if (userId && userId.startsWith('temp_')) {
      console.log(`🔄 Replacing temporary ID ${userId} with ${validUserId}`);
    }

    return res.status(200).json({
      success: true,
      data: {
        _id: validUserId,
        phone: formattedPhone,
        verified: true,
        lastVerifiedAt: user.lastVerifiedAt,
        needsVerification: !isWithinGracePeriod(user.lastVerifiedAt)
      }
    });

  } catch (error) {
    console.error("❌ User validation error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to validate user"
    });
  }
};

// ------------------- CHECK API STATUS -------------------
exports.checkAPIStatus = async (req, res) => {
  try {
    console.log('🔍 Checking Africa\'s Talking API status...');
    
    const credentials = {
      apiKey: process.env.AT_API_KEY,
      username: process.env.AT_USERNAME,
      environment: process.env.AT_ENV || 'sandbox'
    };
    
    console.log('🔑 Credentials:', {
      username: credentials.username,
      apiKey: credentials.apiKey ? 'Set ✓' : 'Missing ✗',
      environment: credentials.environment
    });

    res.status(200).json({
      success: true,
      message: 'API status check',
      credentials: {
        username: credentials.username,
        apiKeySet: !!credentials.apiKey,
        environment: credentials.environment
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('API status check error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ------------------- DIRECT SMS TEST -------------------
exports.directSMSTest = async (req, res) => {
  try {
    const { phone, message } = req.body;
    
    if (!phone) {
      return res.status(400).json({ 
        success: false,
        message: 'Phone number required' 
      });
    }
    
    const testMessage = message || 'Test message from Safari Ride API';
    const formattedPhone = formatPhoneNumber(phone);
    
    console.log('🧪 Direct SMS Test:');
    console.log('  To:', formattedPhone);
    console.log('  Message:', testMessage);
    
    const options = {
      to: [formattedPhone],
      message: testMessage,
      from: process.env.AT_ENV === 'sandbox' ? '' : 'SAFARI'
    };
    
    console.log('📤 Sending with options:', options);
    
    const response = await sms.send(options);
    console.log('✅ Response:', response);
    
    return res.status(200).json({
      success: true,
      message: 'Test SMS sent',
      response: response
    });
    
  } catch (error) {
    console.error('Direct SMS test error:', error.message || error);
    return res.status(500).json({
      success: false,
      message: 'Test failed',
      error: error.message
    });
  }
};

// ------------------- TEST SMS ENDPOINT -------------------
exports.testSMS = async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ 
        success: false,
        message: 'Phone number required' 
      });
    }
    
    console.log('🧪 Testing SMS to:', phone);
    
    const testOTP = '123456';
    const formattedPhone = formatPhoneNumber(phone);
    
    // Send test SMS using the same function
    sendMessage(formattedPhone, testOTP);
    
    return res.status(200).json({
      success: true,
      message: 'Test SMS initiated. Check console for details.',
      phone: formattedPhone
    });
    
  } catch (error) {
    console.error('Test SMS error:', error);
    return res.status(500).json({
      success: false,
      message: 'Test SMS failed',
      error: error.message
    });
  }
};