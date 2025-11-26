
const moment = require('moment-timezone');
const HolidayCalendar = require('../models/holidayCalendar');

exports.setHolidaysForYear = async (req, res) => {
  const { year, holidays } = req.body;

  if (!year || !holidays) {
    return res.status(400).json({ success: false, error: 'Year and holidays are required.' });
  }

  try {
    const calendar = await HolidayCalendar.findOneAndUpdate(
      { companyId: req.user.companyId, year },
      { 
        companyId: req.user.companyId,
        year,
        holidays: holidays.map(h => ({
          startDate: moment(h.startDate).startOf('day').toDate(),
          endDate: h.endDate ? moment(h.endDate).startOf('day').toDate() : moment(h.startDate).startOf('day').toDate(),
          name: h.name,
          type: h.type || 'national',
          applicableToAll: h.applicableToAll !== false
        }))
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({ success: true, data: calendar });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.getHolidaysForYear = async (req, res) => {
  const { year = moment().year() } = req.query;
  try {
    const calendar = await HolidayCalendar.findOne({ companyId: req.user.companyId, year });
    res.json({ success: true, data: calendar || { year, holidays: [] } });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};
