const mongoose = require("mongoose");
require("dotenv").config();

let connection = null;

async function connectDB() {
  if (connection) return connection;

  connection = await mongoose.connect(process.env.dbURL); // ✔ NO OPTIONS

  console.log("🔥 Shared MongoDB Connected");
  return connection;
}

module.exports = connectDB;
