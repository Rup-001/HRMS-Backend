require('dotenv').config();
const express = require('express');
const cors = require('cors');

const routes = require('./routes');
const passport = require('./middleware/auth');

app.use(cors());
app.use(express.json());
app.use(passport.initialize());
app.use('/api', routes);

// const deviceLogsRoutes = require("./routes/deviceLogsRoutes")
// const attendanceRoutes = require('./routes/attendanceRoutes');
// const employeeRoutes = require('./routes/employeeRoutes');

// const app = express();

// // Middleware
// app.use(cors());
// app.use(express.json());

// // // Routes
// app.use('/api/deviceLogs', deviceLogsRoutes);
// // app.use('/api/attendance', attendanceRoutes);
// app.use('/api/employees', employeeRoutes);


// Health check
app.get('/', (req, res) => res.json({ message: 'Attendance API Running' }));

module.exports = app;