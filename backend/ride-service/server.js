const express = require('express');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const path = require('path');
require('dotenv').config();

const session = require('express-session');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//db connection
mongoose
  .connect(process.env.dbURL)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('MongoDB error:', err));

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
        secure: false, // change to true on HTTPS
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      }
    })
  );

  //Routes
 const FareRoutes = require("./Routes/fare.js")

  //api
   app.use('/api', FareRoutes)

  // START SERVER
const PORT = process.env.PORT || 8000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on ${PORT}`);
});