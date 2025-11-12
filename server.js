const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, `.env.${process.env.NODE_ENV || 'development'}`) });
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const routes = require('./routes');
const passport = require('./middleware/auth');
const swaggerDocs = require("./swagger/swaggerConfig");


const app = express();
app.use('/uploads', express.static('uploads'));

// Middleware
app.use(cors());
app.use(express.json());
app.use(passport.initialize());

// Routes
app.use('/api', routes);

// Health check
app.get('/', (req, res) => res.json({ message: 'HRMS API Running' }));

const PORT = process.env.PORT || 5000;

swaggerDocs(app); 

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