const mongoose = require('mongoose');

const userDeviceSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  userId: { type: String, required: true },
  uid: Number,       // 123
  name: String,
  name: { type: String },
  role: { type: String },
  password: { type: String },
  cardNo: { type: String }
}, { timestamps: true, indexes: [{ key: { companyId: 1, userId: 1 }, unique: true }] });

// module.exports = mongoose.model('UserDevice', userDeviceSchema);
module.exports = mongoose.models.UserDevice || mongoose.model('UserDevice', userDeviceSchema);
