// const path = require('path');
// require('dotenv').config({ path: path.resolve(__dirname, `.env.${process.env.NODE_ENV || 'development'}`) });
// const express = require('express');
// const cors = require('cors');
// const connectDB = require('./config/database');
// const routes = require('./routes');
// const passport = require('./middleware/auth');
// const swaggerDocs = require("./swagger/swaggerConfig");
// const dropOldLeavePolicyIndex = require('./migrations/dropOldLeavePolicyIndex'); // Import migration script


// const app = express();
// app.use('/uploads', express.static('uploads'));

// // Middleware
// app.use(cors());
// app.use(express.json());
// app.use(passport.initialize());

// // Routes
// app.use('/api', routes);

// // Health check
// app.get('/', (req, res) => res.json({ message: 'HRMS API Running' }));

// const PORT = process.env.PORT || 5000;

// swaggerDocs(app); 

// const startServer = async () => {
//   try {
//     await connectDB();
//     await dropOldLeavePolicyIndex(); // Call the migration script here
//     app.listen(PORT, () => {
//       console.log(`🚀 Server running on http://localhost:${PORT}`);
//       // Import cron jobs
//       require('./services/cronJob');
//     });
//   } catch (error) {
//     console.error(`❌ Server failed to start:`, error.message);
//     process.exit(1);
//   }
// };

// startServer();


// server.js
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, `.env.${process.env.NODE_ENV || 'development'}`),
});

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose'); // Required for index management

const connectDB = require('./config/database');
const routes = require('./routes');
const passport = require('./middleware/auth');
const swaggerDocs = require('./swagger/swaggerConfig');

// Removed: mongoose.set('autoIndex', false); to allow Mongoose to create indexes

const app = express();

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// API Routes
app.use('/api', routes);

// Health Check
app.get('/', (req, res) => {
  res.json({ message: 'HRMS API Running', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Swagger Documentation
swaggerDocs(app);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB(); // Establish database connection

    // --- Start: Explicit Index Dropping Logic ---
    console.log('Attempting to drop old conflicting indexes...');
    try {
      const leaveEntitlementCollection = mongoose.connection.collection('leaveentitlements');
      const leavePolicyCollection = mongoose.connection.collection('leavepolicies');

      // Drop old employeeId_1 index from LeaveEntitlement
      const leaveEntitlementIndexes = await leaveEntitlementCollection.getIndexes();
      if (leaveEntitlementIndexes.employeeId_1) {
        await leaveEntitlementCollection.dropIndex('employeeId_1');
        console.log('SUCCESS: Dropped old "employeeId_1" index from leaveentitlements collection.');
      } else {
        console.log('INFO: "employeeId_1" index not found on leaveentitlements. No action needed.');
      }

      // Drop old companyId_1 index from LeavePolicy
      const leavePolicyIndexes = await leavePolicyCollection.getIndexes();
      if (leavePolicyIndexes.companyId_1) {
        await leavePolicyCollection.dropIndex('companyId_1');
        console.log('SUCCESS: Dropped old "companyId_1" index from leavepolicies collection.');
      } else {
        console.log('INFO: "companyId_1" index not found on leavepolicies. No action needed.');
      }

      console.log('Finished checking/dropping old indexes.');
    } catch (indexError) {
      console.error('ERROR: Failed to drop old indexes:', indexError.message);
      // Decide if this error should stop server startup. For now, we'll log and continue.
    }
    // --- End: Explicit Index Dropping Logic ---

    app.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode`);
      console.log(`API Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`Health Check:       http://localhost:${PORT}`);

      // Start cron jobs only after server is up
      require('./services/cronJob');
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();