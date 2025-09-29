// const app = require('./app');
// const connectDB = require('./config/database');


// const PORT = process.env.PORT || 5000;

// const startServer = async () => {
//   try {
//     await connectDB();
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


require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const routes = require('./routes');
const passport = require('./middleware/auth');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(passport.initialize());

// Routes
app.use('/api', routes);

// Health check
app.get('/', (req, res) => res.json({ message: 'HRMS API Running' }));

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      // Import cron jobs
      require('./services/cronJob');
    });
  } catch (error) {
    console.error(`❌ Server failed to start:`, error.message);
    process.exit(1);
  }
};

startServer();