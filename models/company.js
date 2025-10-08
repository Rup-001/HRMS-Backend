const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  logoUrl: { type: String }, // For company logo
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// module.exports = mongoose.model('Company', companySchema);
module.exports = mongoose.models.Company || mongoose.model('Company', companySchema);
