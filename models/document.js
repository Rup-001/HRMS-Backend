const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  documentType: { 
    type: String, 
    enum: ['contract', 'offer_letter', 'id_proof', 'certificate', 'other', 'policy'], 
    required: true 
  },
  fileUrl: { type: String, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  description: { type: String },
  isCommon: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);