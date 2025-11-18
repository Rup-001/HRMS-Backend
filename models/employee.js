const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company'},
  oldEmployeeCode: { type: String },
  newEmployeeCode: { type: String, unique: true },
  // deviceUserId: { type: String },
deviceUserId: { type: String, unique: true, sparse: true },
deviceUid: { type: Number, unique: true, sparse: true },
  fullName: { type: String, required: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  designation: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation' },
  joiningDate: { type: Date },
  lastWorkingDay: { type: Date },
  ageOfService: { type: String },
  personalPhoneNumber: { type: String },
  emergencyContactNumber: { type: String },
  email: { type: String },
  hasIdCard: { type: Boolean, default: false },
  idCardStatus: { type: String },
  presentAddress: { type: String },
  permanentAddress: { type: String },
  gender: { type: String },
  dob: { type: Date },
  bloodGroup: { type: String },
  nidPassportNumber: { type: String },
  fatherName: { type: String },
  motherName: { type: String },
  employeeStatus: { 
    type: String, 
    enum: ['active', 'inactive', 'terminated', 'resigned', 'probation'],
    default: 'active' 
  },
  role: { 
    type: String, 
    enum: ['Super Admin', 'C-Level Executive', 'Company Admin', 'HR Manager', 'Manager', 'Employee'], 
    default: 'Employee',
    required: true 
  },
  separationType: { type: String },
  separationReason: { type: String, enum: ['resigned', 'terminated', 'layoff', null], default: null },
  separationRemarks: { type: String },
  idCardReturned: { type: Boolean, default: false },
  appointmentLetter: { type: String },
  resume: { type: String },
  nidCopy: { type: String },
  passportSizePhoto: { type: String },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift', default: null },
  hasUserAccount: { type: Boolean, default: false }
}, { timestamps: true },

);
module.exports = mongoose.models.Employee || mongoose.model('Employee', employeeSchema);