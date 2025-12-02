const moment = require('moment-timezone');

const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Dhaka';

const timezone = {
  // Get current time in app timezone
  now: () => moment.tz(APP_TIMEZONE),

  // Convert device log timestamp to app timezone-aware moment
  // Device logs are already in local time, parse them in app timezone
  fromDeviceLog: (deviceTimestamp) => {
    return moment.tz(deviceTimestamp, APP_TIMEZONE);
  },

  // Convert local time to UTC for database storage
  toUTC: (localMoment) => {
    if (!localMoment || !localMoment.isValid()) return null;
    return localMoment.clone().tz('UTC').toDate();
  },

  // Convert UTC from DB back to app timezone
  fromUTC: (utcDate) => {
    if (!utcDate) return null;
    return moment(utcDate).tz(APP_TIMEZONE);
  },

  // Business logic helpers - all in app timezone
  startOfDay: (date) => moment(date).tz(APP_TIMEZONE).startOf('day'),
  endOfDay: (date) => moment(date).tz(APP_TIMEZONE).endOf('day'),
  startOfMonth: (date) => moment(date).tz(APP_TIMEZONE).startOf('month'),
  endOfMonth: (date) => moment(date).tz(APP_TIMEZONE).endOf('month'),
  startOfYear: (date) => moment(date).tz(APP_TIMEZONE).startOf('year'),

  // Date range helpers
  dateRange: (startDate, endDate) => {
    const start = moment(startDate).tz(APP_TIMEZONE).startOf('day');
    const end = moment(endDate).tz(APP_TIMEZONE).endOf('day');
    return { start, end };
  },

  // Format for display
  format: (date, fmt = 'YYYY-MM-DD HH:mm:ss') => {
    if (!date) return null;
    return moment(date).tz(APP_TIMEZONE).format(fmt);
  },

  // Format date only
  formatDate: (date, fmt = 'YYYY-MM-DD') => {
    if (!date) return null;
    return moment(date).tz(APP_TIMEZONE).format(fmt);
  },

  // Parse string date in app timezone
  // Handles both date-only (YYYY-MM-DD) and ISO datetime strings
  parse: (dateString, format) => {
    if (!dateString) return null;
    
    // If no format specified, try to detect it
    if (!format) {
      // If it looks like ISO datetime (contains T), parse it properly
      if (dateString.includes('T')) {
        // For ISO strings, parse them as-is first to preserve time info
        return moment(dateString).tz(APP_TIMEZONE);
      }
      // Otherwise default to date-only format
      format = 'YYYY-MM-DD';
    }
    
    return moment.tz(dateString, format, APP_TIMEZONE);
  },

  // Get timezone info
  getTimezone: () => APP_TIMEZONE,

  // Get UTC offset
  getOffset: () => moment.tz(APP_TIMEZONE).format('Z'),

  // Check if date is today in app timezone
  isToday: (date) => moment(date).tz(APP_TIMEZONE).isSame(moment.tz(APP_TIMEZONE), 'day'),

  // Get year for holiday calendar lookup
  getYear: (date) => moment(date).tz(APP_TIMEZONE).year()
};

module.exports = timezone;
