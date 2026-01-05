// payment-service/server.js - COMPLETE WORKING VERSION
const express = require('express');
const mongoose = require('mongoose');
const connectDB = require("../shared/db");
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false // Disable for development
}));

// CORS configuration
app.use(cors({
    origin: '*', // Allow all origins for testing
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Import routes
const paymentRoutes = require('./routes/payment.js');

// Use routes
app.use('/api/payments', paymentRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        success: true,
        service: 'Safari Ride Payment Service',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        endpoints: {
            payments: '/api/payments',
            health: '/api/payments/health',
            test: '/api/payments/test',
            dbHealth: '/api/payments/db-health'
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err.message);
    
    res.status(500).json({
        success: false,
        error: err.message,
        timestamp: new Date().toISOString()
    });
});

// Start server
const PORT = process.env.PORT || 3007;
const startServer = async () => {
    try {
        console.log('🚀 Starting Safari Ride Payment Service...');
        console.log('📋 Configuration:');
        console.log(`   Port: ${PORT}`);
        console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`   M-Pesa Mode: ${process.env.SAFARICOM_CONSUMER_KEY ? (process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX') : 'Not configured'}`);
        
        // Step 1: Connect to MongoDB with retries
        console.log('\n🔄 Step 1: Connecting to MongoDB...');
        let dbConnected = false;
        let retries = 0;
        const maxRetries = 5;
        
        while (!dbConnected && retries < maxRetries) {
            try {
                await connectDB();
                dbConnected = true;
                console.log('✅ MongoDB connected successfully');
            } catch (dbError) {
                retries++;
                console.log(`⚠️ MongoDB connection attempt ${retries}/${maxRetries} failed:`, dbError.message);
                if (retries < maxRetries) {
                    console.log(`⏳ Retrying in 2 seconds...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        
        if (!dbConnected) {
            console.log('❌ Could not connect to MongoDB after multiple attempts');
            console.log('⚠️ Starting service without database connection...');
        }
        
        // Step 2: Start HTTP server
        console.log('\n🔄 Step 2: Starting HTTP server...');
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log('\n' + '='.repeat(50));
            console.log('✅ PAYMENT SERVICE STARTED SUCCESSFULLY');
            console.log('='.repeat(50));
            console.log(`🌐 Server running on: http://localhost:${PORT}`);
            console.log(`📡 API Base URL: http://localhost:${PORT}/api/payments`);
            console.log(`🗄️  Database: ${mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}`);
            console.log(`💰 M-Pesa: ${process.env.SAFARICOM_CONSUMER_KEY ? '✅ Configured' : '❌ Not configured'}`);
            console.log('='.repeat(50) + '\n');
            
            console.log('📋 Available Endpoints:');
            console.log('   GET  /                           - Service status');
            console.log('   GET  /api/payments/health        - Health check');
            console.log('   GET  /api/payments/db-health     - Database health');
            console.log('   GET  /api/payments/test          - Test endpoint');
            console.log('   POST /api/payments/mpesa/stk-push - Initiate M-Pesa');
            console.log('   POST /api/payments/mpesa/callback - M-Pesa callback');
            console.log('   POST /api/payments/cash          - Cash payment');
            console.log('   GET  /api/payments/status        - Payment status');
            console.log('   GET  /api/payments/driver/:id/payments - Driver payments\n');
        });
        
        // Handle server errors
        server.on('error', (error) => {
            console.error('❌ Server error:', error);
            if (error.code === 'EADDRINUSE') {
                console.log(`Port ${PORT} is already in use. Trying ${parseInt(PORT) + 1}...`);
                process.exit(1);
            }
        });
        
    } catch (error) {
        console.error('❌ Failed to start payment service:', error);
        process.exit(1);
    }
};

startServer();

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM received. Shutting down gracefully...');
    
    if (mongoose.connection.readyState === 1) {
        mongoose.connection.close(false, () => {
            console.log('✅ MongoDB connection closed.');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});

process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT received. Shutting down...');
    process.exit(0);
});

module.exports = app;