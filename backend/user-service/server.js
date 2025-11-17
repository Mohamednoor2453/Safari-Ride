const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//routes('./
const authRoutes = require('./Routes/auth.js');


//routes apis
app.use('/api', authRoutes);

// Connect MongoDB
mongoose
  .connect(process.env.dbURL)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('MongoDB error:', err));

// Listen on all interfaces for mobile connection
const PORT = process.env.PORT || 8000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on ${PORT}`);
});
