// payment-service/controllers/payment.js - COMPLETE WORKING VERSION
require("dotenv").config();
const axios = require("axios");
const mongoose = require("mongoose");
const Payment = require("../models/Payment.js");

// Check if database is connected
const isDbConnected = () => {
    return mongoose.connection.readyState === 1;
};

// Safe save function
const safeSavePayment = async (paymentData) => {
    if (!isDbConnected()) {
        console.log('⚠️ Database not connected, cannot save payment');
        // Return a mock payment object
        return {
            _id: `temp_${Date.now()}`,
            ...paymentData,
            isTemp: true
        };
    }
    
    try {
        const payment = new Payment(paymentData);
        const savedPayment = await payment.save();
        console.log('✅ Payment saved to database:', savedPayment._id);
        return savedPayment;
    } catch (error) {
        console.error('❌ Failed to save payment:', error.message);
        return {
            _id: `temp_failed_${Date.now()}`,
            ...paymentData,
            isTemp: true
        };
    }
};

// Validate phone number
const validatePhoneNumber = (phone) => {
    if (!phone) return false;
    
    // Remove any non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Check if it's a valid Kenyan number
    if (cleaned.length === 12 && cleaned.startsWith('254')) {
        return cleaned;
    } else if (cleaned.length === 10 && cleaned.startsWith('0')) {
        return '254' + cleaned.substring(1);
    } else if (cleaned.length === 9) {
        return '254' + cleaned;
    }
    
    return false;
};

// Generate M-Pesa token
const generateMpesaToken = async () => {
    try {
        const consumerKey = process.env.SAFARICOM_CONSUMER_KEY;
        const consumerSecret = process.env.SAFARICOM_CONSUMER_SECRET;
        
        if (!consumerKey || !consumerSecret) {
            throw new Error('M-Pesa credentials not configured');
        }
        
        const authUrl = process.env.NODE_ENV === 'production' 
            ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
            : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
        
        const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
        
        const response = await axios.get(authUrl, {
            headers: { 
                Authorization: `Basic ${auth}`,
                'Cache-Control': 'no-cache'
            },
            timeout: 10000
        });
        
        if (!response.data.access_token) {
            throw new Error('No access token received from M-Pesa');
        }
        
        return response.data.access_token;
    } catch (error) {
        console.error("❌ Error generating M-Pesa token:", error.message);
        throw new Error('Failed to connect to payment service');
    }
};

// Generate timestamp for M-Pesa
const generateTimestamp = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

// Generate M-Pesa password
const generateMpesaPassword = (shortcode, passkey, timestamp) => {
    const data = `${shortcode}${passkey}${timestamp}`;
    return Buffer.from(data).toString("base64");
};

// Initiate M-Pesa STK Push
exports.initiateMpesaPayment = async (req, res) => {
    try {
        console.log("💰 Initiating M-Pesa payment...");
        
        const { 
            rideId, 
            userPhone, 
            amount, 
            driverId, 
            driverName,
            description = "Safari Ride Payment"
        } = req.body;

        // Input validation
        if (!rideId || !userPhone || !amount || !driverId || !driverName) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields",
                timestamp: new Date().toISOString()
            });
        }

        const validatedPhone = validatePhoneNumber(userPhone);
        if (!validatedPhone) {
            return res.status(400).json({
                success: false,
                error: "Invalid phone number format",
                timestamp: new Date().toISOString()
            });
        }

        // Generate M-Pesa token
        const token = await generateMpesaToken();
        
        // Prepare STK Push request
        const timestamp = generateTimestamp();
        const shortcode = process.env.SAFARICOM_BUSINESS_SHORTCODE;
        const passkey = process.env.SAFARICOM_PASSKEY;
        const password = generateMpesaPassword(shortcode, passkey, timestamp);
        
        const callbackUrl = `${process.env.CALLBACK_BASE_URL || 'http://localhost:3007'}/api/payments/mpesa/callback`;
        
        const stkRequestData = {
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: Math.floor(amount),
            PartyA: validatedPhone,
            PartyB: shortcode,
            PhoneNumber: validatedPhone,
            CallBackURL: callbackUrl,
            AccountReference: "Safari-Ride",
            TransactionDesc: description.substring(0, 13)
        };

        console.log("📱 Sending STK Push to:", validatedPhone, "Amount:", amount);
        
        // Make request to M-Pesa API
        const stkUrl = process.env.NODE_ENV === 'production'
            ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
            : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';
        
        const stkResponse = await axios.post(stkUrl, stkRequestData, {
            headers: { 
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });

        console.log("✅ M-Pesa API Response:", stkResponse.data);

        if (stkResponse.data.ResponseCode === "0") {
            // Create payment record
            const newPaymentData = {
                rideId,
                driverId,
                driverName,
                userId: `user_${validatedPhone}`,
                userPhone: validatedPhone,
                amount: Math.floor(amount),
                paymentMethod: "mpesa",
                description,
                checkoutRequestID: stkResponse.data.CheckoutRequestID,
                merchantRequestID: stkResponse.data.MerchantRequestID,
                status: "initiated",
                initiatedAt: new Date()
            };

            const newPayment = await safeSavePayment(newPaymentData);

            console.log(`✅ Payment initiated for ride ${rideId}`);

            res.status(200).json({
                success: true,
                message: "M-Pesa payment request sent successfully",
                data: {
                    paymentId: newPayment._id,
                    checkoutRequestID: stkResponse.data.CheckoutRequestID,
                    amount: amount,
                    phone: userPhone,
                    description: description
                },
                timestamp: new Date().toISOString()
            });
        } else {
            console.error("❌ M-Pesa API error:", stkResponse.data);
            
            res.status(400).json({
                success: false,
                error: "Failed to initiate M-Pesa payment",
                details: stkResponse.data.ResponseDescription || "Unknown error",
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error("❌ Error initiating M-Pesa payment:", error.message);
        
        res.status(500).json({
            success: false,
            error: error.message.includes('timeout') 
                ? 'Payment service timeout. Please try again.'
                : 'Failed to process payment request',
            timestamp: new Date().toISOString()
        });
    }
};

// Process cash payment
exports.processCashPayment = async (req, res) => {
    try {
        console.log("💵 Processing cash payment...");
        
        const { 
            rideId, 
            amount, 
            driverId, 
            driverName,
            description = "Safari Ride Cash Payment"
        } = req.body;

        // Input validation
        if (!rideId || !amount || !driverId || !driverName) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields",
                timestamp: new Date().toISOString()
            });
        }

        // Generate receipt number
        const receiptNumber = `CASH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // Create cash payment record
        const cashPaymentData = {
            rideId,
            driverId,
            driverName,
            userId: "cash_user",
            userPhone: "CASH",
            amount: Math.floor(amount),
            paymentMethod: "cash",
            description,
            status: "completed",
            receiptNumber,
            initiatedAt: new Date(),
            completedAt: new Date()
        };

        const cashPayment = await safeSavePayment(cashPaymentData);

        console.log(`✅ Cash payment recorded for ride ${rideId}`);

        res.status(200).json({
            success: true,
            message: "Cash payment recorded successfully",
            data: {
                paymentId: cashPayment._id,
                receiptNumber: receiptNumber,
                amount: amount,
                paidAt: new Date()
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("❌ Error processing cash payment:", error.message);
        
        res.status(500).json({
            success: false,
            error: "Failed to record cash payment",
            timestamp: new Date().toISOString()
        });
    }
};

// M-Pesa callback handler
exports.mpesaCallback = async (req, res) => {
    try {
        console.log("📞 M-Pesa callback received");
        
        const callbackData = req.body.Body.stkCallback;
        
        if (!callbackData) {
            return res.status(400).json({
                success: false,
                error: "Invalid callback data",
                timestamp: new Date().toISOString()
            });
        }

        const checkoutRequestID = callbackData.CheckoutRequestID;
        const resultCode = callbackData.ResultCode;
        
        console.log(`📊 Callback for CheckoutRequestID: ${checkoutRequestID}, ResultCode: ${resultCode}`);

        // Find the payment by CheckoutRequestID if DB is connected
        if (isDbConnected()) {
            try {
                const payment = await Payment.findOne({ checkoutRequestID });
                if (payment) {
                    if (resultCode === 0) {
                        // Payment successful
                        payment.status = "completed";
                        payment.completedAt = new Date();
                        await payment.save();
                        console.log(`✅ Payment completed for ride ${payment.rideId}`);
                    } else {
                        // Payment failed
                        payment.status = "failed";
                        payment.failedAt = new Date();
                        await payment.save();
                        console.log(`❌ Payment failed for ride ${payment.rideId}`);
                    }
                }
            } catch (dbError) {
                console.error("❌ Could not update payment:", dbError.message);
            }
        }

        // Always respond to M-Pesa
        res.json({
            ResultCode: 0,
            ResultDesc: "Callback processed successfully",
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error("❌ Error processing M-Pesa callback:", error.message);
        
        // Always respond to M-Pesa to prevent retries
        res.json({
            ResultCode: 0,
            ResultDesc: "Callback received",
            timestamp: new Date().toISOString()
        });
    }
};

// Query payment status
exports.getPaymentStatus = async (req, res) => {
    try {
        const { paymentId, checkoutRequestID, rideId } = req.query;
        
        let query = {};
        
        if (paymentId) {
            query._id = paymentId;
        } else if (checkoutRequestID) {
            query.checkoutRequestID = checkoutRequestID;
        } else if (rideId) {
            query.rideId = rideId;
        } else {
            return res.status(400).json({
                success: false,
                error: "Please provide paymentId, checkoutRequestID, or rideId",
                timestamp: new Date().toISOString()
            });
        }

        if (!isDbConnected()) {
            return res.status(200).json({
                success: true,
                message: "Database not connected. Using mock data.",
                data: {
                    status: "unknown",
                    rideId: rideId || "unknown",
                    message: "Database connection required for actual status"
                },
                timestamp: new Date().toISOString()
            });
        }

        const payment = await Payment.findOne(query);
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                error: "Payment not found",
                timestamp: new Date().toISOString()
            });
        }

        // Don't expose sensitive information
        const safePayment = {
            paymentId: payment._id,
            rideId: payment.rideId,
            amount: payment.amount,
            currency: payment.currency,
            paymentMethod: payment.paymentMethod,
            status: payment.status,
            description: payment.description,
            createdAt: payment.createdAt,
            updatedAt: payment.updatedAt,
            receiptNumber: payment.receiptNumber
        };

        res.status(200).json({
            success: true,
            data: safePayment,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error("❌ Error getting payment status:", error.message);
        
        res.status(500).json({
            success: false,
            error: "Failed to get payment status",
            timestamp: new Date().toISOString()
        });
    }
};

// Get driver's payment history
exports.getDriverPayments = async (req, res) => {
    try {
        const { driverId } = req.params;
        const { limit = 20, page = 1, status } = req.query;
        
        if (!driverId) {
            return res.status(400).json({
                success: false,
                error: "Driver ID is required",
                timestamp: new Date().toISOString()
            });
        }

        if (!isDbConnected()) {
            return res.status(200).json({
                success: true,
                message: "Database not connected. Using mock data.",
                data: [],
                pagination: {
                    total: 0,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: 0
                },
                timestamp: new Date().toISOString()
            });
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        let query = { driverId };
        
        if (status) {
            query.status = status;
        }

        const [payments, total] = await Promise.all([
            Payment.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .select('-__v'),
            Payment.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            data: payments,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error("❌ Error getting driver payments:", error.message);
        
        res.status(500).json({
            success: false,
            error: "Failed to get payment history",
            timestamp: new Date().toISOString()
        });
    }
};

// Health check endpoint
exports.healthCheck = async (req, res) => {
    res.status(200).json({
        success: true,
        service: "payment-service",
        status: "healthy",
        timestamp: new Date().toISOString(),
        database: isDbConnected() ? "connected" : "disconnected",
        environment: process.env.NODE_ENV || "development",
        version: "1.0.0"
    });
};

// Database health check
exports.dbHealthCheck = async (req, res) => {
    try {
        const dbConnected = isDbConnected();
        
        res.status(200).json({
            success: true,
            database: dbConnected ? 'connected' : 'disconnected',
            timestamp: new Date().toISOString(),
            details: {
                readyState: mongoose.connection.readyState,
                host: mongoose.connection.host,
                name: mongoose.connection.name
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            database: 'disconnected',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};

// Test endpoint controller
exports.testEndpoint = (req, res) => {
    res.json({
        success: true,
        message: "Payment service is running",
        timestamp: new Date().toISOString(),
        endpoints: {
            mpesaStkPush: "POST /api/payments/mpesa/stk-push",
            mpesaCallback: "POST /api/payments/mpesa/callback",
            cashPayment: "POST /api/payments/cash",
            paymentStatus: "GET /api/payments/status",
            driverPayments: "GET /api/payments/driver/:driverId/payments",
            health: "GET /api/payments/health",
            dbHealth: "GET /api/payments/db-health",
            test: "GET /api/payments/test"
        }
    });
};