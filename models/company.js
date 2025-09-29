const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: { type: String, required: true }
}, { timestamps: true });

// module.exports = mongoose.model('Company', companySchema);
module.exports = mongoose.models.Company || mongoose.model('Company', companySchema);
