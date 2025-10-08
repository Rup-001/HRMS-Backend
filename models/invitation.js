const mongoose = require('mongoose');

const invitationSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  email: { type: String, required: true },
  token: { type: String, required: true, unique: true },
  temporaryPassword: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  accepted: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.models.Invitation || mongoose.model('Invitation', invitationSchema);