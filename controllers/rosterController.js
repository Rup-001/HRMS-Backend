// const fs = require('fs');
// const Roster = require('../models/roster');
// const ShiftTemplate = require('../models/shiftTemplate');
// const Employee = require('../models/employee');
// const xlsx = require('xlsx');
// const moment = require('moment');

// const Roster = require('../models/roster');
// const ShiftTemplate = require('../models/shiftTemplate');
// const Employee = require('../models/employee');
// const xlsx = require('xlsx');
// const moment = require('moment');
// const fs = require('fs');

// exports.uploadRosterExcel = async (req, res) => {
//   try {
//     if (!req.file || !req.body.weekStartDate) {
//       return res.status(400).json({ success: false, error: 'File and weekStartDate required' });
//     }

//     const weekStart = moment(req.body.weekStartDate, 'YYYY-MM-DD');
//     if (!weekStart.isValid()) return res.status(400).json({ success: false, error: 'Invalid date' });

//     const workbook = xlsx.readFile(req.file.path);
//     const sheet = workbook.Sheets[workbook.SheetNames[0]];
//     const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

//     const templates = await ShiftTemplate.find({ companyId: req.user.companyId });
//     const templateMap = {};
//     templates.forEach(t => {
//       templateMap[t.code.toUpperCase()] = t;
//       templateMap[t.code.toLowerCase()] = t;
//     });

//     const employees = await Employee.find({ companyId: req.user.companyId }).lean();

//     const operations = [];
//     let matched = 0;
//     let notFound = [];

//     for (const row of rows) {
//       let employee = null;

//       // 1. Match by Employee Code (priority)
//       const empCode = row['Employee Code'] || row['employee code'] || row['EmployeeCode'] || row['Code'] || row['code'];
//       if (empCode) {
//         const codeStr = empCode.toString().trim();
//         employee = employees.find(e => 
//           e.newEmployeeCode === codeStr || 
//           e.employeeId === codeStr ||
//           e.employeeCode === codeStr
//         );
//       }

//       // 2. Fallback to Full Name
//       if (!employee) {
//         const fullName = row['Full Name'] || row['full name'] || row['FullName'] || row['Name'] || row['name'];
//         if (fullName) {
//           const nameStr = fullName.toString().trim().toLowerCase();
//           employee = employees.find(e => {
//             const dbName = (e.fullName || e.name || '').toString().trim().toLowerCase();
//             return dbName === nameStr || dbName.includes(nameStr) || nameStr.includes(dbName);
//           });
//         }
//       }

//       if (!employee) {
//         notFound.push(`${empCode || 'N/A'} - ${row['Full Name'] || row['Name'] || 'Unknown'}`);
//         continue;
//       }

//       matched++;
//       console.log('MATCHED →', employee.newEmployeeCode, employee.fullName);

//       const days = [];
//       let dayOffset = 0;
//       const headers = Object.keys(row).filter(h => !['Employee Code', 'Full Name', 'employee code', 'full name', 'Code', 'Name'].includes(h));

//       for (let i = 0; i < headers.length && dayOffset < 7; i++) {
//         const val = row[headers[i]]?.toString().trim();
//         let code = val && !['-', '—'].includes(val) ? val.toUpperCase().replace(/[^A-Z0-9-]/g, '') : 'O';
//         const template = templateMap[code] || templateMap['O'];
//         if (!template) continue;

//         days.push({
//           date: weekStart.clone().add(dayOffset, 'days').toDate(),
//           code: template.code.toUpperCase(),
//           label: template.label,
//           isOff: template.isOff,
//           onSiteHours: template.onSiteHours,
//           remoteHours: template.remoteHours,
//           onSiteShiftId: template.onSiteShiftId,
//           remote: { status: 'none' }
//         });
//         dayOffset++;
//       }

//       operations.push({
//         updateOne: {
//           filter: { employeeId: employee._id, weekStartDate: weekStart.toDate() },
//           update: {
//             $set: {
//               companyId: req.user.companyId,
//               employeeId: employee._id,
//               uploadedBy: req.user._id,
//               status: 'published',
//               days
//             }
//           },
//           upsert: true
//         }
//       });
//     }

//     if (operations.length > 0) {
//       await Roster.bulkWrite(operations);
//     }

//     res.json({
//       success: true,
//       message: 'Roster uploaded successfully!',
//       matched,
//       notFound: notFound.slice(0, 20),
//       total: rows.length
//     });

//   } catch (error) {
//     console.error('Upload error:', error);
//     res.status(500).json({ success: false, error: error.message });
//   } finally {
//     if (req.file?.path) fs.unlink(req.file.path, () => {});
//   }
// };


// exports.uploadRosterExcel = async (req, res) => {
//   try {
//     if (!req.file || !req.body.weekStartDate) {
//       return res.status(400).json({ success: false, error: 'File and weekStartDate required' });
//     }

//     const weekStart = moment(req.body.weekStartDate, 'YYYY-MM-DD');
//     if (!weekStart.isValid()) return res.status(400).json({ success: false, error: 'Invalid weekStartDate' });

//     const workbook = xlsx.readFile(req.file.path);
//     const sheet = workbook.Sheets[workbook.SheetNames[0]];
//     const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

//     if (rows.length === 0) return res.status(400).json({ success: false, error: 'Empty file' });

//     // Load templates
//     const templates = await ShiftTemplate.find({ companyId: req.user.companyId });
//     const templateMap = {};
//     templates.forEach(t => {
//       templateMap[t.code.toUpperCase()] = t;
//     });

//     // Load employees
//     const employees = await Employee.find({ companyId: req.user.companyId }).lean();

//     const operations = [];
//     let matched = 0;
//     let notFound = [];

//     for (const row of rows) {
//       // === MATCH EMPLOYEE ===
//       let employee = null;

//       // 1. By Employee Code
//       const codeVal = row['Employee Code'] || row['employee code'] || row['EmployeeCode'] || row['Code'] || row['code'];
//       if (codeVal) {
//         const codeStr = codeVal.toString().trim();
//         employee = employees.find(e => 
//           e.newEmployeeCode === codeStr || 
//           e.employeeId === codeStr ||
//           e.employeeCode === codeStr
//         );
//       }

//       // 2. By Name
//       if (!employee) {
//         const nameVal = row['Name'] || row['name'] || row['Full Name'] || row['full name'];
//         if (nameVal) {
//           const nameStr = nameVal.toString().trim().toLowerCase();
//           employee = employees.find(e => 
//             (e.fullName || e.name || '').toString().toLowerCase().includes(nameStr)
//           );
//         }
//       }

//       if (!employee) {
//         notFound.push(`${codeVal || 'N/A'} - ${row['Name'] || 'Unknown'}`);
//         continue;
//       }

//       matched++;
//       console.log('MATCHED →', employee.newEmployeeCode, employee.fullName || employee.name);

//       // === BUILD 7 DAYS ===
//       const days = [];
//       const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

//       for (let i = 0; i < 7; i++) {
//         const dayName = dayNames[i];
//         const cellValue = row[dayName]?.toString().trim() || '';

//         let code = 'O';
//         if (cellValue && cellValue !== '-' && cellValue !== '—' && cellValue !== '') {
//           code = cellValue.toUpperCase().replace(/[^A-Z0-9-]/g, '');
//         }

//         const template = templateMap[code] || templateMap['O'];
//         if (!template) continue;

//         const currentDate = weekStart.clone().add(i, 'days').toDate();

//         days.push({
//           date: currentDate,
//           code: template.code.toUpperCase(),
//           label: template.label,
//           isOff: template.isOff || false,
//           onSiteHours: template.onSiteHours || 0,
//           remoteHours: template.remoteHours || 0,
//           onSiteShiftId: template.onSiteShiftId || null,
//           remote: { status: 'none' }
//         });
//       }

//       // === SAVE TO DB (THIS IS THE KEY PART) ===
//       operations.push({
//         updateOne: {
//           filter: {
//             employeeId: employee._id,
//             weekStartDate: weekStart.toDate()
//           },
//           update: {
//             $set: {
//               companyId: req.user.companyId,
//               employeeId: employee._id,
//               uploadedBy: req.user._id,
//               uploadedAt: new Date(),
//               status: 'published',
//               days: days                          // NOW 100% INCLUDED
//             }
//           },
//           upsert: true
//         }
//       });
//     }

//     if (operations.length > 0) {
//       await Roster.bulkWrite(operations);
//     }

//     res.json({
//       success: true,
//       message: 'Roster uploaded!',
//       matched,
//       notFound,
//       total: operations.length
//     });

//   } catch (error) {
//     console.error('Error:', error);
//     res.status(500).json({ success: false, error: error.message });
//   } finally {
//     if (req.file?.path) fs.unlink(req.file.path, () => {});
//   }
// };


// controllers/rosterController.js
const Roster = require('../models/roster');
const ShiftTemplate = require('../models/shiftTemplate');
const Employee = require('../models/employee');
const xlsx = require('xlsx');
const moment = require('moment');
const fs = require('fs');

exports.uploadRosterExcel = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    if (!req.body.weekStartDate) return res.status(400).json({ success: false, error: 'weekStartDate required' });

    const weekStart = moment.utc(req.body.weekStartDate, 'YYYY-MM-DD').startOf('day');
    if (!weekStart.isValid()) return res.status(400).json({ success: false, error: 'Invalid weekStartDate' });

    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) return res.status(400).json({ success: false, error: 'Excel file is empty' });

    // ─────────────────────────────────────────────────────
    // 1. Load and normalize Shift Templates
    // ─────────────────────────────────────────────────────
    const templates = await ShiftTemplate.find({ companyId: req.user.companyId }).lean();

    const templateMap = {}; // Key: uppercase clean code → template object

    templates.forEach(t => {
      const code = (t.code || '').toString().trim();
      if (!code) return;
      const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
      templateMap[clean] = t;
      // Also store original code for display
      templateMap[code.toUpperCase()] = t;
    });

    // Guarantee "O" always exists
    if (!templateMap['O']) {
      templateMap['O'] = {
        code: 'O',
        label: 'Off Day',
        isOff: true,
        onSiteHours: 0,
        remoteHours: 0,
        onSiteShiftId: null,
      };
    }

    // ─────────────────────────────────────────────────────
    // 2. Load Employees
    // ─────────────────────────────────────────────────────
    const employees = await Employee.find({ companyId: req.user.companyId }).lean();

    const operations = [];
    let matched = 0;
    let notFound = [];
    let totalDays = 0;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (const row of rows) {
      // ───── Employee Matching ─────
      let employee = null;
      const empCode = (row['Employee Code'] || row['employee code'] || row['Code'] || row['code'] || '').toString().trim();

      if (empCode) {
        employee = employees.find(e =>
          [e.newEmployeeCode, e.employeeId, e.employeeCode].includes(empCode)
        );
      }

      if (!employee && (row['Name'] || row['name'])) {
        const name = (row['Name'] || row['name']).toString().trim().toLowerCase();
        employee = employees.find(e => {
          const full = (e.fullName || e.name || '').toString().toLowerCase();
          return full.includes(name) || name.includes(full.split(' ')[0]);
        });
      }

      if (!employee) {
        notFound.push(`${empCode || '??'} - ${row['Name'] || '??'}`);
        continue;
      }

      matched++;
      const days = [];

      // ───── Process 7 days ─────
      for (let i = 0; i < 7; i++) {
        const rawCell = (row[dayNames[i]] || '').toString().trim();
        let isRemote = false;
        let finalCode = 'O';
        let template = templateMap['O']; // default

        if (!rawCell || rawCell === '-' || rawCell === '—') {
          // Empty cell → Off
          finalCode = 'O';
        } else {
          const upper = rawCell.toUpperCase();

          if (upper.includes('REMOTE')) {
            isRemote = true;
            // Extract code after "REMOTE" (e.g. Remote-E → E, REMOTE-M → M, RemoteMorning → MORNING)
            const match = upper.match(/REMOTE-?(.+)/);
            const codePart = match ? match[1].replace(/[^A-Z0-9]/g, '') : 'O';

            template = templateMap[codePart] || templateMap['O'];
            finalCode = template.code.toUpperCase() || 'O';
          } else {
            // Normal shift: E, M, N, etc.
            const cleanCode = upper.replace(/[^A-Z0-9]/g, '');
            template = templateMap[cleanCode] || templateMap['O'];
            finalCode = template.code.toUpperCase() || 'O';
          }
        }

        // Final fallback
        if (!template) template = templateMap['O'];

        days.push({
          date: weekStart.clone().add(i, 'days').toDate(),
          code: finalCode,
          label: template.label || (finalCode === 'O' ? 'Off Day' : 'Unknown Shift'),
          isOff: template.isOff || false,
          onSiteHours: isRemote ? 0 : (template.onSiteHours || 0),
          remoteHours: isRemote ? (template.onSiteHours || template.remoteHours || 8) : (template.remoteHours || 0),
          onSiteShiftId: template.onSiteShiftId || null,
          remote: { status: isRemote ? 'approved' : 'none' },
        });
        totalDays++;
      }

      // ───── Save Roster ─────
      operations.push({
        updateOne: {
          filter: {
            employeeId: employee._id,
            weekStartDate: weekStart.toDate(),
          },
          update: {
            $set: {
              companyId: req.user.companyId,
              employeeId: employee._id,
              uploadedBy: req.user._id,
              uploadedAt: new Date(),
              status: 'published',
              days,
            },
          },
          upsert: true,
        },
      });
    }

    // ───── Bulk Write ─────
    if (operations.length > 0) {
      await Roster.bulkWrite(operations);
    }

    // ───── Success Response ─────
    res.json({
      success: true,
      message: 'Roster uploaded successfully!',
      weekStart: weekStart.format('YYYY-MM-DD'),
      matched,
      notFound,
      totalEmployees: operations.length,
      totalDaysSaved: totalDays,
      note: 'Supports E, M, Remote-E, Remote-M, and any custom codes',
    });

  } catch (error) {
    console.error('Roster upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    // Clean up uploaded file
    if (req.file?.path) {
      fs.unlink(req.file.path, err => {
        if (err) console.error('Failed to delete temp file:', err);
      });
    }
  }
};
exports.requestRemoteHours = async (req, res) => {
    try {
      const { employeeId, date, hours, reason } = req.body;
  
      const roster = await Roster.findOne({
        employeeId,
        'days.date': new Date(date)
      });
  
      if (!roster) return res.status(404).json({ success: false, error: 'No roster found' });
  
      const day = roster.days.find(d => d.date.toDateString() === new Date(date).toDateString());
      if (!day || day.remoteHours === 0) {
        return res.status(400).json({ success: false, error: 'No remote hours scheduled' });
      }
      if (day.remote.status !== 'none') {
        return res.status(400).json({ success: false, error: 'Already requested' });
      }
  
      day.remote = {
        status: 'pending',
        requestedHours: hours || day.remoteHours,
        reason,
        requestedAt: new Date()
      };
  
      await roster.save();
      res.json({ success: true, message: 'Remote request sent' });
    } catch (error) {
          res.status(500).json({ success: false, error: error.message });
        }
      };
      
      exports.getMyRoster = async (req, res) => {
        try {
          const employeeId = req.user.employeeId; // Assuming req.user has employeeId
      
          if (!employeeId) {
            return res.status(403).json({ success: false, error: 'Employee ID not found in user session.' });
          }
      
          const weekStart = req.query.week
            ? moment(req.query.week, 'YYYY-MM-DD').startOf('week').toDate()
            : moment().startOf('week').toDate(); // Default to current week
      
          const roster = await Roster.findOne({
            employeeId: employeeId,
            weekStartDate: weekStart
          }).populate('days.onSiteShiftId', 'name startTime endTime'); // Populate shift details
      
          if (!roster) {
            return res.status(404).json({ success: false, error: 'Roster not found for this employee and week.' });
          }
      
          res.status(200).json({ success: true, data: roster });
      
        } catch (error) {
          console.error('Error fetching my roster:', error);
          res.status(500).json({ success: false, error: error.message });
        }
      };  

// exports.getAllRosters = async (req, res) => {
//   try {
//     const { companyId } = req.user;
//     const { employeeId, week, limit = 10, skip = 0 } = req.query;

//     let filter = { companyId };
//     if (employeeId) {
//       filter.employeeId = employeeId;
//     }
//     if (week) {
//       filter.weekStartDate = moment(week, 'YYYY-MM-DD').startOf('week').toDate();
//     }

//     const rosters = await Roster.find(filter)
//       .populate('employeeId', 'fullName newEmployeeCode email')
//       .populate('uploadedBy', 'email')
//       .populate('days.onSiteShiftId', 'name startTime endTime')
//       .limit(parseInt(limit))
//       .skip(parseInt(skip))
//       .sort({ weekStartDate: -1, 'employeeId.fullName': 1 });

//     const totalCount = await Roster.countDocuments(filter);

//     res.status(200).json({ success: true, count: totalCount, data: rosters });

//   } catch (error) {
//     console.error('Error fetching all rosters:', error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// Your other APIs (getAllRosters, my-roster, etc.) remain perfect
exports.getAllRosters = async (req, res) => {
  try {
    const { companyId } = req.user;
    const { employeeId, week, limit = 10, skip = 0 } = req.query;

    let filter = { companyId };
    if (employeeId) filter.employeeId = employeeId;
    if (week) {
      filter.weekStartDate = moment(week, 'YYYY-MM-DD').startOf('week').toDate();
    }

    const rosters = await Roster.find(filter)
      .populate('employeeId', 'fullName newEmployeeCode email')
      .populate('uploadedBy', 'email')
      .populate('days.onSiteShiftId', 'name startTime endTime')
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .sort({ weekStartDate: -1 });

    const totalCount = await Roster.countDocuments(filter);

    res.status(200).json({ success: true, count: totalCount, data: rosters });
  } catch (error) {
    console.error('Error fetching rosters:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

  // 3. Manager Approves/Rejects
  exports.approveRemoteHours = async (req, res) => {
    try {
      const { employeeId, date, action, note } = req.body; // action = "approved" or "rejected"
      const managerId = req.user._id;
  
      const roster = await Roster.findOne({
        employeeId,
        'days.date': new Date(date)
      });
  
      if (!roster) return res.status(404).json({ success: false, error: 'Not found' });
  
      const day = roster.days.find(d => d.date.toDateString() === new Date(date).toDateString());
      if (day.remote.status !== 'pending') {
        return res.status(400).json({ success: false, error: 'Not pending' });
      }
  
      day.remote.status = action;
      day.remote.approvedBy = managerId;
      day.remote.approvedAt = new Date();
      day.remote.note = note || '';
  
      await roster.save();
      res.json({ success: true, message: `Remote hours ${action}` });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  };
