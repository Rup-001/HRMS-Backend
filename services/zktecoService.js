// // // services/zktecoService.js
// const Zkteco = require("zkteco-js");
// const fs = require("fs").promises;
// const path = require("path");

// class ZKService {
//   constructor() {
//     this.device = new Zkteco(
//       process.env.ZKTECO_DEVICE_IP,
//       process.env.ZKTECO_DEVICE_PORT || 4370,
//       process.env.ZKTECO_INPORT || 5200,
//       5000
//     );
//     this.connected = false;
//   }

//   async connect() {
//     await this.device.createSocket();
//   }

// //   async disconnect() {
// //     await this.device.disconnect();
// //   }

// async disconnect() {
//     if (this.connected) {
//       try {
//         await this.device.disconnect();
//       } catch (err) {
//         console.warn("⚠️ Error during disconnection:", err.message);
//       } finally {
//         this.connected = false;
//       }
//     }}

//   async testConnection() {
//     try {
//       await this.connect();
//       await this.disconnect();
//       return { success: true, message: "Device connected successfully" };
//     } catch (error) {
//       return { success: false, error: error.message };
//     }
//   }

//   // 🔹 Sync users
//   async syncUsers() {
//     try {
//       await this.connect();
//       const deviceUsers = (await this.device.getUsers()).data || [];

//       const logDir = path.join(__dirname, "../logs");
//       await fs.mkdir(logDir, { recursive: true });
//       const file = path.join(logDir, `users.json`);

//       // Read existing users if file exists
//       let existingUsers = [];
//       try {
//         const data = await fs.readFile(file, "utf-8");
//         existingUsers = JSON.parse(data);
//       } catch (err) {
//         existingUsers = [];
//       }

//       // Find new users
//       const existingIds = new Set(existingUsers.map(u => u.userId));
//       const newUsers = deviceUsers.filter(u => !existingIds.has(u.userId));

//       // Append and save
//       const updatedUsers = [...existingUsers, ...newUsers];
//       await fs.writeFile(file, JSON.stringify(updatedUsers, null, 2));

//       await this.disconnect();

//       console.log(
//         `👥 Users Sync: ${newUsers.length} new, total ${updatedUsers.length}`
//       );

//       return { success: true, new: newUsers.length, total: updatedUsers.length };
//     } catch (error) {
//       await this.disconnect();
//       throw error;
//     }
//   }

//   // 🔹 Sync logs
//   async syncDeviceLogs() {
//     try {
//       await this.connect();
//       const logs = (await this.device.getAttendances()).data || [];

//       const logDir = path.join(__dirname, "../logs");
//       await fs.mkdir(logDir, { recursive: true });
//       const file = path.join(logDir, `logs.json`);

//       // Read existing logs if file exists
//       let existingLogs = [];
//       try {
//         const data = await fs.readFile(file, "utf-8");
//         existingLogs = JSON.parse(data);
//       } catch (err) {
//         existingLogs = [];
//       }

//       // Deduplicate by timestamp + user_id
//       const existingKeys = new Set(
//         existingLogs.map(l => `${l.user_id}_${l.timestamp}`)
//       );
//       const newLogs = logs.filter(
//         l => !existingKeys.has(`${l.user_id}_${l.timestamp}`)
//       );

//       // Append and save
//       const updatedLogs = [...existingLogs, ...newLogs];
//       await fs.writeFile(file, JSON.stringify(updatedLogs, null, 2));

//       await this.disconnect();

//       console.log(
//         `📝 Logs Sync: ${newLogs.length} new, total ${updatedLogs.length}`
//       );

//       return { success: true, new: newLogs.length, total: updatedLogs.length };
//     } catch (error) {
//       await this.disconnect();
//       throw error;
//     }
//   }
// }

// module.exports = new ZKService();


// const Zkteco = require('zkteco-js');
// const fs = require('fs').promises;
// const path = require('path');
// const Log = require('../models/log');

// class ZKService {
//   constructor() {
//     this.device = new Zkteco(
//       process.env.ZKTECO_DEVICE_IP,
//       process.env.ZKTECO_DEVICE_PORT || 4370,
//       process.env.ZKTECO_INPORT || 5200,
//       5000
//     );
//     this.connected = false;
//   }

//   async connect() {
//     try {
//       await this.device.createSocket();
//       this.connected = true;
//       console.log('✅ Connected to ZKTeco device');
//     } catch (error) {
//       throw new Error(`Failed to connect to ZKTeco device: ${error.message}`);
//     }
//   }

//   async disconnect() {
//     if (this.connected) {
//       try {
//         await this.device.disconnect();
//         console.log('🔌 Disconnected from ZKTeco device');
//       } catch (err) {
//         console.warn('⚠️ Error during disconnection:', err.message);
//       } finally {
//         this.connected = false;
//       }
//     }
//   }

//   async testConnection() {
//     try {
//       await this.connect();
//       await this.disconnect();
//       return { success: true, message: 'Device connected successfully' };
//     } catch (error) {
//       return { success: false, error: error.message };
//     }
//   }

//   // 🔹 Sync users (unchanged)
//   async syncUsers() {
//     try {
//       await this.connect();
//       const deviceUsers = (await this.device.getUsers()).data || [];

//       const logDir = path.join(__dirname, '../logs');
//       await fs.mkdir(logDir, { recursive: true });
//       const file = path.join(logDir, `users.json`);

//       // Read existing users if file exists
//       let existingUsers = [];
//       try {
//         const data = await fs.readFile(file, 'utf-8');
//         existingUsers = JSON.parse(data);
//       } catch (err) {
//         existingUsers = [];
//       }

//       // Find new users
//       const existingIds = new Set(existingUsers.map(u => u.userId));
//       const newUsers = deviceUsers.filter(u => u && u.userId && !existingIds.has(u.userId));

//       // Append and save
//       const updatedUsers = [...existingUsers, ...newUsers];
//       await fs.writeFile(file, JSON.stringify(updatedUsers, null, 2));

//       await this.disconnect();

//       console.log(`👥 Users Sync: ${newUsers.length} new, total ${updatedUsers.length}`);

//       return { success: true, new: newUsers.length, total: updatedUsers.length };
//     } catch (error) {
//       await this.disconnect();
//       throw new Error(`User sync failed: ${error.message}`);
//     }
//   }

//   // 🔹 Sync logs
//   async syncDeviceLogs() {
//     try {
//       await this.connect();
//       const logs = (await this.device.getAttendances()).data || [];
//       console.log('📜 Raw logs (first 5):', JSON.stringify(logs.slice(0, 5), null, 2));

//       // Validate logs
//       if (!Array.isArray(logs)) {
//         throw new Error('Invalid log data from device');
//       }

//       // Fetch existing log keys from MongoDB
//       const existingKeys = new Set(
//         (await Log.find({}, 'user_id timestamp')).map(l => `${l.user_id}_${new Date(l.timestamp).getTime()}`)
//       );
//       console.log(`🔑 Existing log keys: ${existingKeys.size}`);

//       // Find new logs
//       const newLogs = logs
//         .filter(l => {
//           if (!l || !l.user_id || !l.record_time) {
//             console.warn('⚠️ Invalid log entry:', l);
//             return false;
//           }
//           try {
//             const timestamp = new Date(l.record_time);
//             if (isNaN(timestamp.getTime())) {
//               console.warn('⚠️ Invalid timestamp in log:', l);
//               return false;
//             }
//             const key = `${l.user_id}_${timestamp.getTime()}`;
//             return !existingKeys.has(key);
//           } catch (err) {
//             console.warn('⚠️ Error parsing log timestamp:', l, err.message);
//             return false;
//           }
//         })
//         .map(l => ({
//           user_id: l.user_id,
//           timestamp: new Date(l.record_time),
//           type: l.type || 0,
//           state: l.state || 0,
//           ip: l.ip || ''
//         }));

//       console.log(`🆕 New logs to insert: ${newLogs.length}`);

//       // Insert new logs
//       if (newLogs.length > 0) {
//         await Log.insertMany(newLogs, { ordered: false });
//       }

//       await this.disconnect();

//       const totalLogs = await Log.countDocuments();
//       console.log(`📝 Logs Sync: ${newLogs.length} new, total ${totalLogs}`);

//       return { success: true, new: newLogs.length, total: totalLogs };
//     } catch (error) {
//       await this.disconnect();
//       throw new Error(`Log sync failed: ${error.message}`);
//     }
//   }
// }

// module.exports = new ZKService();




const Zkteco = require('zkteco-js');
const fs = require('fs').promises;
const path = require('path');
const Log = require('../models/log');
const Employee = require('../models/Employee');
const EmployeesAttendance = require('../models/EmployeesAttendance');
    const mongoose = require('mongoose');
const LastSync = require('../models/lastSync'); 
const moment = require('moment-timezone');

class ZKService {
  constructor() {
    this.device = new Zkteco(
      process.env.ZKTECO_DEVICE_IP,
      process.env.ZKTECO_DEVICE_PORT || 4370,
      process.env.ZKTECO_INPORT || 5200,
      5000
    );
    this.connected = false;
  }

  async connect() {
    try {
      await this.device.createSocket();
      this.connected = true;
      console.log('✅ Connected to ZKTeco device');
    } catch (error) {
      throw new Error(`Failed to connect to ZKTeco device: ${error.message}`);
    }
  }

  async disconnect() {
    if (this.connected) {
      try {
        await this.device.disconnect();
        console.log('🔌 Disconnected from ZKTeco device');
      } catch (err) {
        console.warn('⚠️ Error during disconnection:', err.message);
      } finally {
        this.connected = false;
      }
    }
  }

  async testConnection() {
    try {
      await this.connect();
      await this.disconnect();
      return { success: true, message: 'Device connected successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 🔹 Sync users (unchanged)
  async syncUsers() {
    try {
      await this.connect();
      const deviceUsers = (await this.device.getUsers()).data || [];

      const logDir = path.join(__dirname, '../logs');
      await fs.mkdir(logDir, { recursive: true });
      const file = path.join(logDir, `users.json`);

      // Read existing users if file exists
      let existingUsers = [];
      try {
        const data = await fs.readFile(file, 'utf-8');
        existingUsers = JSON.parse(data);
      } catch (err) {
        existingUsers = [];
      }

      // Find new users
      const existingIds = new Set(existingUsers.map(u => u.userId));
      const newUsers = deviceUsers.filter(u => u && u.userId && !existingIds.has(u.userId));

      // Append and save
      const updatedUsers = [...existingUsers, ...newUsers];
      await fs.writeFile(file, JSON.stringify(updatedUsers, null, 2));

      await this.disconnect();

      console.log(`👥 Users Sync: ${newUsers.length} new, total ${updatedUsers.length}`);

      return { success: true, new: newUsers.length, total: updatedUsers.length };
    } catch (error) {
      await this.disconnect();
      throw new Error(`User sync failed: ${error.message}`);
    }
  }

  
// 🔹 Sync logs
async syncDeviceLogs() {
  try {
    await this.connect();
    const deviceId = process.env.ZKTECO_DEVICE_IP;
    // Get last synced timestamp for this device
    const lastSync = await LastSync.findOne({ deviceId });
    const lastSyncTimestamp = lastSync ? lastSync.lastSyncTimestamp : new Date(0);
    console.log(`🔍 Fetching logs since ${lastSyncTimestamp.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })} for device ${deviceId} at ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}`);

    const logs = (await this.device.getAttendances()).data || [];
    console.log(`📡 Received ${logs.length} total logs from device`);
    console.log('📜 Raw logs (first 5):', JSON.stringify(logs.slice(0, 5), null, 2));

    // Validate logs
    if (!Array.isArray(logs)) {
      throw new Error('Invalid log data from device');
    }

    // Filter logs newer than lastSyncTimestamp
    const newLogs = logs
      .filter(l => {
        if (!l || !l.user_id || !l.record_time) {
          console.warn('⚠️ Invalid log entry:', JSON.stringify(l, null, 2));
          return false;
        }
        try {
          const timestamp = new Date(l.record_time);
          if (isNaN(timestamp.getTime())) {
            console.warn('⚠️ Invalid timestamp in log:', JSON.stringify(l, null, 2));
            return false;
          }
          const isNew = timestamp > lastSyncTimestamp;
        //   console.log(`📅 Log for user ${l.user_id} at ${timestamp.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}: ${isNew ? 'NEW' : 'OLD'}`);
          return isNew;
        } catch (err) {
          console.warn('⚠️ Error parsing log timestamp:', JSON.stringify(l, null, 2), err.message);
          return false;
        }
      })
      .map(l => ({
        user_id: l.user_id,
        timestamp: new Date(l.record_time),
        type: l.type ?? 0,
        state: l.state ?? 0,
        ip: l.ip ?? ''
      }));

    console.log(`✅ Filtered ${newLogs.length} new logs out of ${logs.length} total`);

    let synced = 0;
    let latestTimestamp = lastSyncTimestamp;

    // Insert new logs to Log model
    if (newLogs.length > 0) {
      const bulkOps = newLogs.map(log => ({
        updateOne: {
          filter: { user_id: log.user_id, timestamp: log.timestamp },
          update: { $set: log },
          upsert: true
        }
      }));
      try {
        const result = await Log.bulkWrite(bulkOps);
        synced = result.upsertedCount + result.modifiedCount;
        console.log(`✅ Bulk write to Log: ${result.upsertedCount} upserted, ${result.modifiedCount} modified`);
      } catch (error) {
        console.error(`❌ Error saving logs to Log model: ${error.message}`);
        throw error;
      }
    }

    // Process attendance for each new log
    for (const log of newLogs) {
      // Find employee by deviceUserId
      const employee = await Employee.findOne({ deviceUserId: log.user_id });
      if (!employee) {
        console.warn(`⚠️ Employee not found for deviceUserId: ${log.user_id}`);
        continue;
      }
      console.log(`✅ Found employee: ${employee._id} for deviceUserId: ${log.user_id}`);

      // Calculate the 24-hour cycle (midnight to midnight in UTC)
      const logTimestamp = new Date(log.timestamp);
      const cycleStart = moment.utc(logTimestamp).startOf('day').toDate();
      console.log(`📅 Cycle start for log at ${logTimestamp.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}: ${cycleStart.toISOString()}`);

      // Find or create attendance record for the cycle
      let attendance = await EmployeesAttendance.findOne({
        employeeId: employee._id,
        date: { $eq: cycleStart }
      });

      const update = {
        companyId: employee.companyId,
        employeeId: employee._id,
        date: cycleStart,
        status: 'Incomplete'
      };

      if (attendance) {
        // Update existing record
        if (!attendance.check_in) {
          attendance.check_in = logTimestamp;
          console.log(`✅ Set check-in: employeeId: ${employee._id}, date: ${cycleStart.toISOString()}, check_in: ${logTimestamp.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}`);
        } else {
          // Update check-out if this timestamp is later
          if (!attendance.check_out || logTimestamp > attendance.check_out) {
            attendance.check_out = logTimestamp;
            console.log(`✅ Updated check-out: employeeId: ${employee._id}, date: ${cycleStart.toISOString()}, check_out: ${logTimestamp.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}`);
          }
        }
      } else {
        // Prepare new record
        update.check_in = logTimestamp;
        console.log(`✅ Preparing new attendance: employeeId: ${employee._id}, date: ${cycleStart.toISOString()}, check_in: ${logTimestamp.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}`);
      }

      // Calculate work hours and status
      if (attendance && attendance.check_in && attendance.check_out) {
        const workHours = (new Date(attendance.check_out) - new Date(attendance.check_in)) / (1000 * 60 * 60);
        attendance.work_hours = Math.round(workHours * 100) / 100;
        attendance.status = workHours  ? 'Present' : 'Incomplete';
        console.log(`✅ Calculated work hours: ${attendance.work_hours}, status: ${attendance.status}`);
      } else if ((attendance && attendance.check_in) || update.check_in) {
        update.status = 'Incomplete';
      } else {
        update.status = 'Absent';
      }

      try {
        if (attendance) {
          // Save updated attendance
          await attendance.save();
          console.log(`✅ Saved updated attendance: employeeId: ${employee._id}, date: ${cycleStart.toISOString()}, check_in: ${attendance.check_in?.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}, check_out: ${attendance.check_out?.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}, status: ${attendance.status}`);
        } else {
          // Create new attendance
          const newAttendance = await EmployeesAttendance.create(update);
          console.log(`✅ Created new attendance: employeeId: ${employee._id}, date: ${cycleStart.toISOString()}, check_in: ${newAttendance.check_in?.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}, check_out: ${newAttendance.check_out?.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}, status: ${newAttendance.status}`);
        }
      } catch (error) {
        console.error(`❌ Error saving attendance for employeeId: ${employee._id}, date: ${cycleStart.toISOString()}: ${error.message}`);
        continue; // Continue with next log
      }

      // Update latest timestamp
      if (logTimestamp > latestTimestamp) {
        latestTimestamp = logTimestamp;
      }
    }

    // Update last sync timestamp if new logs were processed
    if (synced > 0) {
      try {
        await LastSync.updateOne(
          { deviceId },
          { $set: { lastSyncTimestamp: latestTimestamp } },
          { upsert: true }
        );
        console.log(`✅ Updated last sync timestamp to ${latestTimestamp.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })} for device ${deviceId}`);
      } catch (error) {
        console.error(`❌ Error updating LastSync: ${error.message}`);
      }
    } else {
      console.log(`ℹ️ No new logs to update last sync timestamp`);
    }

    await this.disconnect();
    const totalLogs = await Log.countDocuments();
    const attendanceCount = await EmployeesAttendance.countDocuments();
    console.log(`✅ Sync completed: ${synced} new logs processed, total logs: ${totalLogs}, total attendance records: ${attendanceCount}`);

    return { success: true, count: synced, total: totalLogs, attendanceCount };
  } catch (error) {
    console.error(`❌ Log sync failed at ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}:`, error.message);
    await this.disconnect();
    throw error;
  }
}

// // 🔹 Sync logs
// async syncDeviceLogs() {
//   try {
//     await this.connect();
//     const deviceId = process.env.ZKTECO_DEVICE_IP;
//     // Get last synced timestamp for this device
//     const lastSync = await LastSync.findOne({ deviceId });
//     const lastSyncTimestamp = lastSync ? lastSync.lastSyncTimestamp : new Date(0);
//     console.log(`🔍 Fetching logs since ${lastSyncTimestamp.toLocaleString()} for device ${deviceId} at ${new Date().toLocaleString()}`);

//     const logs = (await this.device.getAttendances()).data || [];
//     console.log(`📡 Received ${logs.length} total logs from device`);

//     // Validate logs
//     if (!Array.isArray(logs)) {
//       throw new Error('Invalid log data from device');
//     }

//     // Filter logs newer than lastSyncTimestamp
//     const newLogs = logs
//       .filter(l => {
//         if (!l || !l.user_id || !l.record_time) {
//           console.warn('⚠️ Invalid log entry:', JSON.stringify(l, null, 2));
//           return false;
//         }
//         try {
//           const timestamp = new Date(l.record_time);
//           if (isNaN(timestamp.getTime())) {
//             console.warn('⚠️ Invalid timestamp in log:', JSON.stringify(l, null, 2));
//             return false;
//           }
//           return timestamp > lastSyncTimestamp;
//         } catch (err) {
//           console.warn('⚠️ Error parsing log timestamp:', JSON.stringify(l, null, 2), err.message);
//           return false;
//         }
//       })
//       .map(l => ({
//         user_id: l.user_id,
//         timestamp: new Date(l.record_time),
//         type: l.type ?? 0,
//         state: l.state ?? 0,
//         ip: l.ip ?? ''
//       }));

//     console.log(`✅ Filtered ${newLogs.length} new logs out of ${logs.length} total`);

//     let synced = 0;
//     let latestTimestamp = lastSyncTimestamp;

//     // Insert new logs to Log model
//     if (newLogs.length > 0) {
//       const bulkOps = newLogs.map(log => ({
//         updateOne: {
//           filter: { user_id: log.user_id, timestamp: log.timestamp },
//           update: { $set: log },
//           upsert: true
//         }
//       }));
//       const result = await Log.bulkWrite(bulkOps);
//       synced = result.upsertedCount + result.modifiedCount;
//       console.log(`✅ Bulk write result: ${result.upsertedCount} upserted, ${result.modifiedCount} modified`);
//     }

//     // Process attendance for each new log
//     for (const log of newLogs) {
//       // Find employee by deviceUserId
//       const employee = await Employee.findOne({ deviceUserId: log.user_id });
//       if (!employee) {
//         console.warn(`⚠️ Employee not found for deviceUserId: ${log.user_id}`);
//         continue;
//       }

//       // Calculate the 24-hour cycle (6 AM to 6 AM)
//       const logTimestamp = new Date(log.timestamp);
//       let cycleStart = new Date(logTimestamp);
//       if (logTimestamp.getHours() < 6) {
//         cycleStart.setDate(cycleStart.getDate() - 1);
//       }
//       cycleStart.setHours(6, 0, 0, 0);
//       const cycleEnd = new Date(cycleStart);
//       cycleEnd.setDate(cycleEnd.getDate() + 1);

//       // Find or create attendance record for the cycle
//       let attendance = await EmployeesAttendance.findOne({
//         employeeId: employee._id,
//         date: { $eq: cycleStart }
//       });

//       const update = {
//         companyId: employee.companyId,
//         employeeId: employee._id,
//         date: cycleStart,
//         status: 'Incomplete'
//       };

//       if (attendance) {
//         // Update existing record
//         if (!attendance.check_in) {
//           // No check-in yet, set this as check-in
//           attendance.check_in = logTimestamp;
//           console.log(`✅ Set check-in for employeeId: ${employee._id}, date: ${cycleStart.toISOString()}, timestamp: ${logTimestamp}`);
//         } else {
//           // Check-in exists, update check-out if this timestamp is later
//           if (!attendance.check_out || logTimestamp > attendance.check_out) {
//             attendance.check_out = logTimestamp;
//             console.log(`✅ Updated check-out for employeeId: ${employee._id}, date: ${cycleStart.toISOString()}, timestamp: ${logTimestamp}`);
//           }
//         }
//       } else {
//         // Create new record with this log as check-in
//         update.check_in = logTimestamp;
//         console.log(`✅ Set check-in for new attendance: employeeId: ${employee._id}, date: ${cycleStart.toISOString()}, timestamp: ${logTimestamp}`);
//       }

//       // Calculate work hours and status
//       if (attendance && attendance.check_in && attendance.check_out) {
//         const workHours = (new Date(attendance.check_out) - new Date(attendance.check_in)) / (1000 * 60 * 60);
//         attendance.work_hours = Math.round(workHours * 100) / 100;
//         attendance.status = workHours   ? 'Present' : 'Incomplete';
//       } else if ((attendance && attendance.check_in) || update.check_in) {
//         update.status = 'Incomplete';
//       } else {
//         update.status = 'Absent';
//       }

//       if (attendance) {
//         // Save updated attendance
//         await attendance.save();
//         console.log(`✅ Updated attendance: employeeId: ${employee._id}, date: ${cycleStart.toISOString()}, check_in: ${attendance.check_in}, check_out: ${attendance.check_out}, status: ${attendance.status}`);
//       } else {
//         // Create new attendance
//         const newAttendance = await EmployeesAttendance.create(update);
//         console.log(`✅ Created attendance: employeeId: ${employee._id}, date: ${cycleStart.toISOString()}, check_in: ${newAttendance.check_in}, check_out: ${newAttendance.check_out}, status: ${newAttendance.status}`);
//       }

//       // Update latest timestamp
//       if (logTimestamp > latestTimestamp) {
//         latestTimestamp = logTimestamp;
//       }
//     }

//     // Update last sync timestamp if new logs were processed
//     if (synced > 0) {
//       await LastSync.updateOne(
//         { deviceId },
//         { $set: { lastSyncTimestamp: latestTimestamp } },
//         { upsert: true }
//       );
//       console.log(`✅ Updated last sync timestamp to ${latestTimestamp.toLocaleString()} for device ${deviceId}`);
//     } else {
//       console.log(`ℹ️ No new logs to update last sync timestamp`);
//     }

//     await this.disconnect();
//     const totalLogs = await Log.countDocuments();
//     console.log(`✅ Sync completed: ${synced} new logs processed, total ${totalLogs}`);

//     return { success: true, count: synced, total: totalLogs };
//   } catch (error) {
//     console.error(`❌ Log sync failed at ${new Date().toLocaleString()}:`, error.message);
//     await this.disconnect();
//     throw error;
//   }
// }


//   async syncDeviceLogs() {
//   try {
//     await this.connect();
//     const deviceId = process.env.ZKTECO_DEVICE_IP;
//     // Get last synced timestamp for this device
//     const lastSync = await LastSync.findOne({ deviceId });
//     const lastSyncTimestamp = lastSync ? lastSync.lastSyncTimestamp : new Date(0);
//     console.log(`🔍 Fetching logs since ${lastSyncTimestamp.toLocaleString()} for device ${deviceId} at ${new Date().toLocaleString()}`);

//     const logs = (await this.device.getAttendances()).data || [];
//     console.log('📜 Raw logs (first 5):', JSON.stringify(logs.slice(0, 5), null, 2));
//     console.log(`🔍 Log types:`, [...new Set(logs.map(l => l.type))]);

//     // Validate logs
//     if (!Array.isArray(logs)) {
//       throw new Error('Invalid log data from device');
//     }

//     // Filter logs newer than lastSyncTimestamp
//     const newLogs = logs
//       .filter(l => {
//         if (!l || !l.user_id || !l.record_time) {
//           console.warn('⚠️ Invalid log entry:', JSON.stringify(l, null, 2));
//           return false;
//         }
//         try {
//           const timestamp = new Date(l.record_time);
//           if (isNaN(timestamp.getTime())) {
//             console.warn('⚠️ Invalid timestamp in log:', JSON.stringify(l, null, 2));
//             return false;
//           }
//           return timestamp > lastSyncTimestamp;
//         } catch (err) {
//           console.warn('⚠️ Error parsing log timestamp:', JSON.stringify(l, null, 2), err.message);
//           return false;
//         }
//       })
//       .map(l => ({
//         user_id: l.user_id,
//         timestamp: new Date(l.record_time),
//         type: l.type ?? 0, // 0: check-in, 1: check-out
//         state: l.state ?? 0,
//         ip: l.ip ?? ''
//       }));

//     console.log(`🆕 New logs to insert: ${newLogs.length}`);

//     let synced = 0;
//     let latestTimestamp = lastSyncTimestamp;

//     // Insert new logs to Log model using bulk upsert to handle any potential duplicates safely
//     if (newLogs.length > 0) {
//       const bulkOps = newLogs.map(log => ({
//         updateOne: {
//           filter: { user_id: log.user_id, timestamp: log.timestamp },
//           update: { $set: log },
//           upsert: true
//         }
//       }));
//       const result = await Log.bulkWrite(bulkOps);
//       synced = result.upsertedCount + result.modifiedCount; // Count new inserts and updates (though updates unlikely)
//       console.log(`✅ Bulk write result: ${result.upsertedCount} upserted, ${result.modifiedCount} modified`);
//     }

//     // Update EmployeesAttendance for the filtered new logs
//     for (const log of newLogs) {
//       const employee = await Employee.findOne({ deviceUserId: log.user_id });
//       if (!employee) {
//         console.warn(`⚠️ Employee not found for deviceUserId: ${log.user_id}`);
//         continue;
//       }

//       const date = new Date(log.timestamp);
//       date.setHours(0, 0, 0, 0); // Normalize to start of day

//       let attendance = await EmployeesAttendance.findOne({
//         employeeId: employee._id,
//         date: { $eq: date }
//       });

//       console.log(`🔄 Updating attendance for employeeId: ${employee._id}, date: ${date.toISOString()}, type: ${log.type}, timestamp: ${log.timestamp}`);

//       const update = {
//         companyId: employee.companyId,
//         employeeId: employee._id,
//         date,
//         status: 'Incomplete'
//       };

//       if (log.type === 0) {
//         // For check-in, only set if not already set or if earlier
//         if (!attendance || !attendance.check_in || log.timestamp < attendance.check_in) {
//           update.check_in = log.timestamp;
//         } else {
//           update.check_in = attendance.check_in; // Keep existing
//         }
//       } else if (log.type === 1) {
//         // For check-out, set if not set or if later
//         if (!attendance || !attendance.check_out || log.timestamp > attendance.check_out) {
//           update.check_out = log.timestamp;
//         } else {
//           update.check_out = attendance.check_out; // Keep existing
//         }
//       }

//       if (attendance) {
//         // Update existing record with potentially adjusted fields
//         if (log.type === 0 && (!attendance.check_in || log.timestamp < attendance.check_in)) {
//           attendance.check_in = log.timestamp;
//         } else if (log.type === 1 && (!attendance.check_out || log.timestamp > attendance.check_out)) {
//           attendance.check_out = log.timestamp;
//         }
//         if (attendance.check_in && attendance.check_out) {
//           const workHours = (new Date(attendance.check_out) - new Date(attendance.check_in)) / (1000 * 60 * 60);
//           attendance.work_hours = Math.round(workHours * 100) / 100;
//           attendance.status = attendance.work_hours >= 8 ? 'Present' : 'Incomplete';
//         } else if (attendance.check_in || attendance.check_out) {
//           attendance.status = 'Incomplete';
//         }
//         await attendance.save();
//         console.log(`✅ Updated attendance: employeeId: ${employee._id}, date: ${date.toISOString()}, check_in: ${attendance.check_in}, check_out: ${attendance.check_out}, status: ${attendance.status}`);
//       } else {
//         // Create new record
//         if (log.type === 0) {
//           update.check_in = log.timestamp;
//         } else if (log.type === 1) {
//           update.check_out = log.timestamp;
//         }
//         if (update.check_in && update.check_out) {
//           const workHours = (new Date(update.check_out) - new Date(update.check_in)) / (1000 * 60 * 60);
//           update.work_hours = Math.round(workHours * 100) / 100;
//           update.status = update.work_hours >= 8 ? 'Present' : 'Incomplete';
//         }
//         const newAttendance = await EmployeesAttendance.create(update);
//         console.log(`✅ Created attendance: employeeId: ${employee._id}, date: ${date.toISOString()}, check_in: ${newAttendance.check_in}, check_out: ${newAttendance.check_out}, status: ${newAttendance.status}`);
//       }

//       // Update latest timestamp
//       if (log.timestamp > latestTimestamp) {
//         latestTimestamp = log.timestamp;
//       }
//     }

//     // Update last sync timestamp if new logs were processed
//     if (synced > 0) {
//       await LastSync.updateOne(
//         { deviceId },
//         { $set: { lastSyncTimestamp: latestTimestamp } },
//         { upsert: true }
//       );
//       console.log(`✅ Updated last sync timestamp to ${latestTimestamp.toLocaleString()} for device ${deviceId}`);
//     } else {
//       console.log(`ℹ️ No new logs to update last sync timestamp`);
//     }

//     await this.disconnect();

//     const totalLogs = await Log.countDocuments();
//     console.log(`📝 Logs Sync: ${synced} new/updated, total ${totalLogs}`);

//     return { success: true, new: synced, total: totalLogs };
//   } catch (error) {
//     await this.disconnect();
//     throw new Error(`Log sync failed: ${error.message}`);
//   }
// }


  // 🔹 Sync logs
//   async syncDeviceLogs() {
//     try {
//       await this.connect();
//       const logs = (await this.device.getAttendances()).data || [];
//       console.log('📜 Raw logs (first 5):', JSON.stringify(logs.slice(0, 5), null, 2));
//       console.log(`🔍 Log types:`, [...new Set(logs.map(l => l.type))]);

//       // Validate logs
//       if (!Array.isArray(logs)) {
//         throw new Error('Invalid log data from device');
//       }

//       // Fetch existing log keys from MongoDB
//       const existingKeys = new Set(
//         (await Log.find({}, 'user_id timestamp')).map(l => `${l.user_id}_${new Date(l.timestamp).getTime()}`)
//       );
//       console.log(`🔑 Existing log keys: ${existingKeys.size}`);

//       // Find new logs
//       const newLogs = logs
//         .filter(l => {
//           if (!l || !l.user_id || !l.record_time) {
//             console.warn('⚠️ Invalid log entry:', JSON.stringify(l, null, 2));
//             return false;
//           }
//           try {
//             const timestamp = new Date(l.record_time);
//             if (isNaN(timestamp.getTime())) {
//               console.warn('⚠️ Invalid timestamp in log:', JSON.stringify(l, null, 2));
//               return false;
//             }
//             const key = `${l.user_id}_${timestamp.getTime()}`;
//             return !existingKeys.has(key);
//           } catch (err) {
//             console.warn('⚠️ Error parsing log timestamp:', JSON.stringify(l, null, 2), err.message);
//             return false;
//           }
//         })
//         .map(l => ({
//           user_id: l.user_id,
//           timestamp: new Date(l.record_time),
//           type: l.type ?? 0, // 0: check-in, 1: check-out
//           state: l.state ?? 0,
//           ip: l.ip ?? ''
//         }));

//       console.log(`🆕 New logs to insert: ${newLogs.length}`);

//       // Insert new logs to Log model
//       if (newLogs.length > 0) {
//         await Log.insertMany(newLogs, { ordered: false });
//       }

//       // Update EmployeesAttendance
//       for (const log of newLogs) {
//         const employee = await Employee.findOne({ deviceUserId: log.user_id });
//         if (!employee) {
//           console.warn(`⚠️ Employee not found for deviceUserId: ${log.user_id}`);
//           continue;
//         }

//         const date = new Date(log.timestamp);
//         date.setHours(0, 0, 0, 0); // Normalize to start of day

//         const attendance = await EmployeesAttendance.findOne({
//           employeeId: employee._id,
//           date: { $eq: date }
//         });

//         console.log(`🔄 Updating attendance for employeeId: ${employee._id}, date: ${date.toISOString()}, type: ${log.type}, timestamp: ${log.timestamp}`);

//         const update = {
//           companyId: employee.companyId,
//           employeeId: employee._id,
//           date,
//           status: 'Incomplete'
//         };

//         if (log.type === 0) {
//           update.check_in = log.timestamp;
//         } else if (log.type === 1) {
//           update.check_out = log.timestamp;
//         }

//         if (attendance) {
//           // Update existing record
//           if (log.type === 0) {
//             attendance.check_in = log.timestamp;
//           } else if (log.type === 1) {
//             attendance.check_out = log.timestamp;
//           }
//           if (attendance.check_in && attendance.check_out) {
//             const workHours = (new Date(attendance.check_out) - new Date(attendance.check_in)) / (1000 * 60 * 60);
//             attendance.work_hours = Math.round(workHours * 100) / 100;
//             attendance.status = workHours >= 8 ? 'Present' : 'Incomplete';
//           } else if (attendance.check_in || attendance.check_out) {
//             attendance.status = 'Incomplete';
//           }
//           await attendance.save();
//           console.log(`✅ Updated attendance: employeeId: ${employee._id}, date: ${date.toISOString()}, check_in: ${attendance.check_in}, check_out: ${attendance.check_out}, status: ${attendance.status}`);
//         } else {
//           // Create new record
//           if (log.type === 0) {
//             update.check_in = log.timestamp;
//           } else if (log.type === 1) {
//             update.check_out = log.timestamp;
//           }
//           if (update.check_in && update.check_out) {
//             update.work_hours = Math.round(((new Date(update.check_out) - new Date(update.check_in)) / (1000 * 60 * 60)) * 100) / 100;
//             update.status = update.work_hours >= 8 ? 'Present' : 'Incomplete';
//           }
//           const newAttendance = await EmployeesAttendance.create(update);
//           console.log(`✅ Created attendance: employeeId: ${employee._id}, date: ${date.toISOString()}, check_in: ${newAttendance.check_in}, check_out: ${newAttendance.check_out}, status: ${newAttendance.status}`);
//         }
//       }

//       await this.disconnect();

//       const totalLogs = await Log.countDocuments();
//       console.log(`📝 Logs Sync: ${newLogs.length} new, total ${totalLogs}`);

//       return { success: true, new: newLogs.length, total: totalLogs };
//     } catch (error) {
//       await this.disconnect();
//       throw new Error(`Log sync failed: ${error.message}`);
//     }
//   }
}

module.exports = new ZKService();