const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  date: { type: Date, required: true },
  name: { type: String, required: true },
  isNational: { type: Boolean, default: false }
}, { timestamps: true });

// module.exports = mongoose.model('Holiday', holidaySchema);
module.exports = mongoose.models.Holiday || mongoose.model('Holiday', holidaySchema);
