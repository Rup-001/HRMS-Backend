const Holiday = require('../models/holiday');
const moment = require('moment-timezone');

exports.createHoliday = async (req, res) => {
  try {
    const { date, name, isNational } = req.body;
    if (!date || !name) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    const holiday = new Holiday({
      companyId: isNational ? null : req.user.companyId,
      date: moment.tz(date, 'Asia/Dhaka').startOf('day').toDate(),
      name,
      isNational
    });
    await holiday.save();
    res.status(201).json({ success: true, data: holiday });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getHolidays = async (req, res) => {
  try {
    const query = req.user.role === 'Employee' || req.user.role === 'Manager' ? 
                 { $or: [{ companyId: req.user.companyId }, { isNational: true }] } : {};
    const holidays = await Holiday.find(query);
    res.status(200).json({ success: true, data: holidays });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};