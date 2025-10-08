const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  oldEmployeeCode: { type: String },
  newEmployeeCode: { type: String, unique: true, required: true },
  deviceUserId: { type: String },
  fullName: { type: String, required: true },
  assignedDepartment: { type: String },
  designation: { type: String },
  currentDesignation: { type: String },
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
  appointmentLetter: { type: String },
  resume: { type: String },
  nidCopy: { type: String },
  passportSizePhoto: { type: String },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  hasUserAccount: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.models.Employee || mongoose.model('Employee', employeeSchema);