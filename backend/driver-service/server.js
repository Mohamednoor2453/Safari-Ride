// driver-service/server.js - COMPLETE FIXED VERSION
const express = require('express');
const connectDB = require("../shared/db");
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const path = require('path');
const cors = require('cors'); // Add this
require('dotenv').config();

const session = require('express-session');

const app = express();

// Add CORS middleware
app.use(cors({
  origin: ['http://localhost:8081', 'http://192.168.1.112:8081'], // React Native dev server
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Content-Disposition']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// mongo db connection
connectDB();

// SESSION setup
app.use(
  session({
    secret: process.env.SESSION_SECRET_KEY || 'your-secret-key-here',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.dbURL,
      collectionName: "sessions"
    }),
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    }
  })
);

// ROUTES
const driverAuthRoutes = require('./Routes/auth.js');
const driverProfileRoutes = require("./Routes/driverProfile.js")

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Driver Service is running',
    port: process.env.PORT || 3004,
    timestamp: new Date().toISOString()
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'Driver API is working' });
});

//apis routes
app.use('/api', driverAuthRoutes);
app.use('/api', driverProfileRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error('Driver Service Error:', err.stack);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ 
    success: false, 
    error: 'Route not found',
    endpoint: req.originalUrl,
    method: req.method
  });
});

// START SERVER
const PORT = process.env.PORT || 3004;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚗 Driver server running on port ${PORT}`);
  console.log(`📞 Health check: http://localhost:${PORT}/api/health`);
  console.log(`✅ Test endpoint: http://localhost:${PORT}/api/test`);
  console.log(`📱 Registration: http://localhost:${PORT}/api/register`);
  console.log(`🔐 Login: http://localhost:${PORT}/api/login`);
});