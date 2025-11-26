
const mongoose = require('mongoose');
const { Schema } = mongoose;

const holidayCalendarSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  year: { type: Number, required: true },
  holidays: [
    {
      startDate: { type: Date, required: true },   // e.g., 2025-04-14
      endDate: { type: Date },                      // Optional, for multi-day holidays
      name: { type: String, required: true },     // e.g., "Pohela Boishakh"
      type: { type: String, enum: ['national', 'religious'], default: 'national' },
      applicableToAll: { type: Boolean, default: true }
    }
  ]
}, { timestamps: true });

// Unique: one calendar per company per year
holidayCalendarSchema.index({ companyId: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('HolidayCalendar', holidayCalendarSchema);
