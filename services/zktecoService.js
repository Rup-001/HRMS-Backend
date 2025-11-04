const Zkteco = require('zkteco-js');
const fs = require('fs').promises;
const path = require('path');
const Log = require('../models/log');
const Employee = require('../models/employee');
const EmployeesAttendance = require('../models/employeesAttendance');
    const mongoose = require('mongoose');
const LastSync = require('../models/lastSync'); 
const moment = require('moment-timezone');
const UserDevice = require('../models/userDevice'); // Adjust the path based on your file structure

class ZKService {
  constructor() {
    this.device = new Zkteco(
      process.env.ZKTECO_DEVICE_IP,
      process.env.ZKTECO_DEVICE_PORT || 4370,
      process.env.ZKTECO_INPORT || 5200,
      20000
    );
    this.connected = false;
  }

  async connect() {
    try {
      await this.device.createSocket();
      this.connected = true;
      console.log('✅ Connected to ZKTeco device');
    } catch (error) {
      console.error(error)
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

// async setUser(userid, name) {
//   try {
//     await this.connect();

//     // Get all users to find the next available UID
//     const users = (await this.device.getUsers()).data || [];
//     const nextUid = users.reduce((maxUid, user) => Math.max(maxUid, user.uid), 0) + 1;

//     // Call the zkteco-js setUser method with the new UID
//     const result = await this.device.setUser(nextUid, userid, name, '', 0, 0);
//     console.log(`👤 User created: ${userid} (${name}) with UID: ${nextUid}`);

//     // Update or create user in UserDevice model
//     await UserDevice.updateOne(
//       { userId: userid },
//       {
//         $set: {
//           uid: nextUid,
//           userId: userid,
//           name: name,
//         }
//       },
//       { upsert: true }
//     );

//     await this.disconnect();
//     return { success: true, message: 'User created successfully', data: result };
//   } catch (error) {
//     await this.disconnect();
//     throw new Error(`Failed to create user: ${error.message}`);
//   }
// }

// async setUser(userid, name) {
//   const maxRetries = 3;
//   let attempt = 0;

//   while (attempt < maxRetries) {
//     attempt++;
//     try {
//       await this.connect();

//       const users = (await this.device.getUsers()).data || [];
//       const existingUser = users.find(u => u && u.userId === userid);

//       if (existingUser) {
//         // Already exists → just sync DB
//         await UserDevice.updateOne(
//           { userId: userid },
//           { $set: { uid: existingUser.uid, userId: userid, name } },
//           { upsert: true }
//         );
//         await this.disconnect();
//         console.log(`ZKService - User already exists on device: ${userid} (UID: ${existingUser.uid})`);
//         return { success: true, exists: true, uid: existingUser.uid };
//       }

//       // Find next available UID
//       const nextUid = users.length > 0 
//         ? Math.max(...users.map(u => u.uid || 0)) + 1 
//         : 1;

//       if (nextUid > 65535) {
//         throw new Error('Device UID limit reached (65535)');
//       }

//       const result = await this.device.setUser(nextUid, userid, name, '', 0, 0);
//       console.log(`ZKService - User created: ${userid} (UID: ${nextUid})`);

//       // Save to UserDevice
//       await UserDevice.updateOne(
//         { userId: userid },
//         { $set: { uid: nextUid, userId: userid, name } },
//         { upsert: true }
//       );

//       await this.disconnect();
//       return { success: true, created: true, uid: nextUid };

//     } catch (error) {
//       await this.disconnect();
//       console.error(`setUser attempt ${attempt} failed:`, error.message);

//       if (attempt === maxRetries) {
//         throw new Error(`Failed to create user after ${maxRetries} attempts: ${error.message}`);
//       }

//       // Wait before retry
//       await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
//     }
//   }
// }


// async setUser(userid, name) {
//   const maxRetries = 3;
//   let attempt = 0;

//   while (attempt < maxRetries) {
//     attempt++;
//     try {
//       await this.connect();
//       const users = (await this.device.getUsers()).data || [];
//       const existing = users.find(u => u.userId === userid);

//       if (existing) {
//         await UserDevice.updateOne(
//           { userId: userid },
//           { $set: { uid: existing.uid, userId: userid, name } },
//           { upsert: true }
//         );
//         await this.disconnect();
//         return { success: true, exists: true, uid: existing.uid };
//       }

//       const nextUid = users.length > 0 
//         ? Math.max(...users.map(u => u.uid || 0)) + 1 
//         : 1;

//       if (nextUid > 65535) throw new Error('Device full');

//       await this.device.setUser(nextUid, userid, name, '', 0, 0);
//       console.log(`ZK: Created ${userid} → UID ${nextUid}`);

//       await UserDevice.updateOne(
//         { userId: userid },
//         { $set: { uid: nextUid, userId: userid, name } },
//         { upsert: true }
//       );

//       await this.disconnect();
//       return { success: true, created: true, uid: nextUid };

//     } catch (error) {
//       await this.disconnect();
//       if (attempt === maxRetries) throw error;
//       await new Promise(r => setTimeout(r, 1000 * attempt));
//     }
//   }
// }


async setUser(userid, name) {
  const maxRetries = 3;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await this.connect();
      const users = (await this.device.getUsers()).data || [];
      const existing = users.find(u => u.userId === userid);

      if (existing) {
        await this.disconnect();
        return { success: true, exists: true, uid: existing.uid };
      }

      const nextUid = users.length > 0 
        ? Math.max(...users.map(u => u.uid || 0)) + 1 
        : 1;

      if (nextUid > 65535) {
        await this.disconnect();
        return { success: false, error: 'Device UID limit reached' };
      }

      const result = await this.device.setUser(nextUid, userid, name, '', 0, 0);
      console.log(`ZK: Created ${userid} → UID ${nextUid}`);

      await UserDevice.updateOne(
        { userId: userid },
        { $set: { uid: nextUid, userId: userid, name } },
        { upsert: true }
      );

      await this.disconnect();
      return { success: true, created: true, uid: nextUid };

    } catch (error) {
      await this.disconnect();
      console.error(`setUser attempt ${i + 1} failed:`, error.message);
      if (i === maxRetries - 1) {
        return { success: false, error: error.message };
      }
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}
// 🔹 Get user by userId (employee code)
async getUserByUserId(userId) {
  try {
    await this.connect();
    const users = (await this.device.getUsers()).data || [];
    const user = users.find(u => u && u.userId === userId);
    await this.disconnect();
    return user || null;
  } catch (error) {
    await this.disconnect();
    console.error('getUserByUserId error:', error.message);
    return null;
  }
}


// ZKService.js
async checkUserExistsOnDevice(userId) {
  const maxRetries = 2;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await this.connect();
      const users = (await this.device.getUsers()).data || [];
      const exists = users.some(u => u && u.userId === userId);
      await this.disconnect();
      return exists;
    } catch (error) {
      await this.disconnect();
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}
}
module.exports = new ZKService();