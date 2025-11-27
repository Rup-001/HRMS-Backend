// // const mongoose = require('mongoose');

// // const rosterSchema = new mongoose.Schema({
// //   companyId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
// //   employeeId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
// //   weekStartDate:   { type: Date, required: true }, // e.g., Monday 2025-11-24

// //   uploadedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
// //   uploadedAt:      { type: Date, default: Date.now },
// //   status:          { type: String, enum: ['draft', 'published'], default: 'published' },

// //   // 7 days of the week
// //   days: [{
// //     date:          { type: Date, required: true },
// //     code:          { type: String, required: true, uppercase: true }, // M, E, O, Remote-E
// //     label:         String,
// //     isOff:         { type: Boolean, default: false },
// //     onSiteHours:   { type: Number, default: 0 },
// //     remoteHours:   { type: Number, default: 0 },
// //     onSiteShiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift' },

// //     // Remote attendance request (embedded)
// //     remote: {
// //       status:     { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
// //       requestedHours: Number,
// //       reason:     String,
// //       requestedAt: Date,
// //       approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
// //       approvedAt:  Date,
// //       note:       String
// //     }
// //   }]
// // }, { timestamps: true });

// // // ONLY ONE RULE: one roster per employee per week
// // rosterSchema.index({ employeeId: 1, weekStartDate: 1 }, { unique: true });

// // module.exports = mongoose.model('Roster', rosterSchema);



// // models/roster.js
// const mongoose = require('mongoose');

// const daySchema = new mongoose.Schema({
//   date:          { type: Date, required: true },
//   code:          { type: String, required: true, trim: true, uppercase: true },
//   label:         { type: String },
//   isOff:         { type: Boolean, default: false },
//   onSiteHours:   { type: Number, default: 0 },
//   remoteHours:   { type: Number, default: 0 },
//   onSiteShiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift' },

//   remote: {
//     status:     { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
//     requestedHours: Number,
//     reason:     String,
//     requestedAt: Date,
//     approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//     approvedAt:  Date,
//     note:       String
//   }
// }, { _id: false }); // optional: no _id for subdocs

// const rosterSchema = new mongoose.Schema({
//   companyId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
//   employeeId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
//   weekStartDate:   { type: Date, required: true },

//   uploadedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   uploadedAt:      { type: Date, default: Date.now },
//   status:          { type: String, enum: ['draft', 'published'], default: 'published' },

//   days: [daySchema]
// }, { 
//   timestamps: true,
//   // THIS IS CRITICAL — prevents silent dropping
//   strict: false
// });

// // Your index
// rosterSchema.index({ employeeId: 1, weekStartDate: 1 }, { unique: true });

// module.exports = mongoose.model('Roster', rosterSchema);

// models/roster.js
const mongoose = require('mongoose');

const daySchema = new mongoose.Schema({
  date:          { type: Date, required: true },
  code:          { type: String, required: true, trim: true }, // ← REMOVED uppercase: true
  label:         String,
  isOff:         { type: Boolean, default: false },
  onSiteHours:   { type: Number, default: 0 },
  remoteHours:   { type: Number, default: 0 },
  onSiteShiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift' },

  remote: {
    status:        { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
    requestedHours: Number,
    reason:        String,
    requestedAt:   Date,
    approvedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt:    Date,
    note:          String
  }
}, { _id: false });

const rosterSchema = new mongoose.Schema({
  companyId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employeeId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  weekStartDate: { type: Date, required: true },

  uploadedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedAt:    { type: Date, default: Date.now },
  status:        { type: String, enum: ['draft', 'published'], default: 'published' },

  days: [daySchema]
}, { 
  timestamps: true,
  strict: false   // safety
});

rosterSchema.index({ employeeId: 1, weekStartDate: 1 }, { unique: true });

module.exports = mongoose.model('Roster', rosterSchema);