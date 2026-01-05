// shared/db.js
const mongoose = require("mongoose");
require("dotenv").config();

// 🔥 CRITICAL: disable mongoose buffering
mongoose.set("bufferCommands", false);
mongoose.set("bufferTimeoutMS", 0);

let connectionPromise = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    console.log("✅ MongoDB already connected");
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  console.log("🔄 Connecting to MongoDB...");

  connectionPromise = mongoose.connect(process.env.dbURL, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    maxPoolSize: 10,
    minPoolSize: 5,
    family: 4,
    retryWrites: true,
    w: "majority"
  });

  try {
    await connectionPromise;
    console.log("🔥 MongoDB connected successfully");
    return mongoose.connection;
  } catch (err) {
    connectionPromise = null;
    console.error("❌ MongoDB connection failed:", err.message);
    throw err;
  }
}

// Wait until DB is connected
connectDB.waitForConnection = async (timeout = 10000) => {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (mongoose.connection.readyState === 1) return true;
    await new Promise(r => setTimeout(r, 300));
  }

  throw new Error("MongoDB connection timeout");
};

module.exports = connectDB;
