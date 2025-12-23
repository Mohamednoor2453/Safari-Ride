const express = require('express');
const connectDB = require("../shared/db");
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo').default;
const cors = require('cors');

const path = require('path');
require('dotenv').config();

const session = require('express-session');

const app = express();

// CORS configuration
app.use(cors({
  origin: ['http://localhost:8081', 'http://192.168.1.112:8081', 'http://192.168.1.112:19006'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Content-Disposition']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
connectDB();

// SESSION setup
app.use(
  session({
    secret: process.env.SESSION_SECRET_KEY,
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

// Import routes
const manageDriversRoutes = require('./Routes/manageDrivers.js');

// Use routes
app.use('/api/admin/drivers', manageDriversRoutes);

// Test route
app.get('/api/admin/test', (req, res) => {
  res.json({ success: true, message: 'Admin API is working' });
});

// Health check route
app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Safari Ride Admin Service',
    endpoints: {
      test: '/api/admin/test',
      unverifiedDrivers: '/api/admin/drivers/unverified',
      verifiedDrivers: '/api/admin/drivers/verified',
      verifyDriver: '/api/admin/drivers/verify (POST)',
      deleteDriver: '/api/admin/drivers/delete (POST)',
      toggleStatus: '/api/admin/drivers/toggle-status (POST)'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler - FIXED: Use a proper path or function
app.use((req, res, next) => {
  res.status(404).json({ 
    success: false, 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// START SERVER
const PORT = process.env.PORT || 3006;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Admin server running on port ${PORT}`);
  console.log(`📊 Admin routes available at http://localhost:${PORT}/api/admin`);
  console.log(`🚗 Driver management: http://localhost:${PORT}/api/admin/drivers`);
  console.log(`🏠 Home page: http://localhost:${PORT}/`);
});