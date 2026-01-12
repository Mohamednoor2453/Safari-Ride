const mongoose = require("mongoose");

let isConnected = false;
let connectionPromise = null;

// Helper function to ensure collection exists
const ensureCollectionExists = async () => {
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections({ name: "payments" }).toArray();
    
    if (collections.length === 0) {
      console.log("📦 Creating 'payments' collection...");
      await db.createCollection("payments");
      
      // Create indexes
      const collection = db.collection("payments");
      await collection.createIndex({ rideId: 1 });
      await collection.createIndex({ checkoutRequestID: 1 });
      await collection.createIndex({ status: 1 });
      await collection.createIndex({ createdAt: -1 });
      await collection.createIndex({ driverId: 1 });
      
      console.log("✅ 'payments' collection created with indexes");
    } else {
      console.log("✅ 'payments' collection exists");
    }
  } catch (error) {
    console.warn("⚠️ Could not ensure collection exists:", error.message);
  }
};

const connectDB = async () => {
  // Return existing connection if ready
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log("✅ Using existing MongoDB connection");
    return mongoose.connection;
  }

  // Return existing connection promise to prevent multiple connections
  if (connectionPromise) {
    console.log("⏳ Returning existing connection promise");
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      const mongoURI = process.env.dbURL;

      if (!mongoURI) {
        throw new Error("❌ dbURL is not defined in environment variables");
      }

      console.log("🔗 Connecting to MongoDB...");

      await mongoose.connect(mongoURI, {
        maxPoolSize: 20, // Increased for concurrent requests
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 30000,
        connectTimeoutMS: 10000,
        retryWrites: true,
        w: 'majority'
      });

      // Wait for connection to be fully established
      await new Promise((resolve, reject) => {
        if (mongoose.connection.readyState === 1) {
          resolve();
        } else {
          mongoose.connection.once('connected', resolve);
          mongoose.connection.once('error', reject);
          
          // Timeout after 10 seconds
          setTimeout(() => reject(new Error("Connection timeout")), 10000);
        }
      });

      isConnected = true;
      console.log(`✅ MongoDB connected to database: ${mongoose.connection.name}`);

      // Ensure the payments collection exists
      await ensureCollectionExists();

      mongoose.connection.on("error", (err) => {
        console.error("❌ MongoDB error:", err.message);
        isConnected = false;
        connectionPromise = null;
      });

      mongoose.connection.on("disconnected", () => {
        console.warn("⚠️ MongoDB disconnected");
        isConnected = false;
        connectionPromise = null;
      });

      // Log connection state
      console.log(`📊 Connection state: ${mongoose.connection.readyState}`);
      console.log(`📊 Host: ${mongoose.connection.host}`);
      console.log(`📊 Database: ${mongoose.connection.name}`);

      return mongoose.connection;
    } catch (error) {
      console.error("❌ MongoDB connection failed:", error.message);
      connectionPromise = null;
      throw error;
    }
  })();

  return connectionPromise;
};

const isDBReady = () => {
  try {
    return mongoose.connection && 
           mongoose.connection.readyState === 1 && 
           mongoose.connection.db; // Also check if db object exists
  } catch (error) {
    return false;
  }
};

// Get database instance safely
const getDB = () => {
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    return mongoose.connection.db;
  }
  return null;
};

// Get collection safely
const getCollection = (collectionName) => {
  const db = getDB();
  if (db) {
    return db.collection(collectionName);
  }
  return null;
};

// Safe write function that handles connection state
const safeDBOperation = async (operation, fallbackValue = null) => {
  if (!isDBReady()) {
    console.warn("⚠️ DB not ready, using fallback");
    return fallbackValue;
  }
  
  try {
    return await operation();
  } catch (error) {
    console.error("❌ DB operation failed:", error.message);
    return fallbackValue;
  }
};

// Clear connection promise (for testing/reconnection)
const resetConnection = () => {
  connectionPromise = null;
  isConnected = false;
};

module.exports = {
  connectDB,
  mongoose,
  isDBReady,
  safeDBOperation,
  getDB,
  getCollection,
  resetConnection
};