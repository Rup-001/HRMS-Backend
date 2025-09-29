const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  timestamp: { type: Date, required: true },
  type: { type: Number, default: 0 },
  state: { type: Number, default: 0 },
  ip: { type: String, default: '' }
}, { timestamps: true, indexes: [{ key: { user_id: 1, timestamp: 1 }, unique: true }] });

// module.exports = mongoose.model('Log', logSchema);
module.exports = mongoose.models.Log || mongoose.model('Log', logSchema);
