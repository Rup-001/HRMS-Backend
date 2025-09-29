const mongoose = require('mongoose');

const lastSyncSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true }, // Unique per device
  lastSyncTimestamp: { type: Date, required: true }
}, { timestamps: true });

// module.exports = mongoose.model('LastSync', lastSyncSchema);
module.exports = mongoose.models.LastSync || mongoose.model('LastSync', lastSyncSchema);
