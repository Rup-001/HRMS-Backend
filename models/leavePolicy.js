
// // models/leavePolicy.js
// const mongoose = require('mongoose');

// const leavePolicySchema = new mongoose.Schema({
//   companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
//   year: { type: Number, required: true }, // New field
//   casual: { type: Number, default: 10 },
//   sick: { type: Number, default: 14 },
//   annual: { type: Number, default: 20 },
//   maternity: { type: Number, default: 84 },
//   festive: { type: Number, default: 11 }
// }, { timestamps: true });

// leavePolicySchema.index({ companyId: 1, year: 1 }, { unique: true });

// module.exports = mongoose.models.LeavePolicy || mongoose.model('LeavePolicy', leavePolicySchema);



const mongoose = require('mongoose');

const leavePolicySchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  year: { type: Number, required: true },
  casual: { type: Number, default: 10 },
  sick: { type: Number, default: 14 },
  annual: { type: Number, default: 20 },
  maternity: { type: Number, default: 84 },
  festive: { type: Number, default: 11 }
}, { 
  timestamps: true,
  // Optional: explicitly disable auto-indexing globally for this model
  autoIndex: false  
});

module.exports = mongoose.models.LeavePolicy || mongoose.model('LeavePolicy', leavePolicySchema);