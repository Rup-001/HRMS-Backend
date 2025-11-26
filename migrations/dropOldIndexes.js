const mongoose = require('mongoose');
const LeavePolicy = require('../models/leavePolicy');
const LeaveEntitlement = require('../models/leaveEntitlement'); // Import LeaveEntitlement model

async function dropOldIndexes() { // Renamed function
  try {
    // Drop old companyId_1 index from LeavePolicy collection
    const leavePolicyIndexes = await LeavePolicy.collection.getIndexes();
    if (leavePolicyIndexes.companyId_1) {
      console.log('Detected old "companyId_1" index on LeavePolicy collection. Dropping...');
      await LeavePolicy.collection.dropIndex('companyId_1');
      console.log('Successfully dropped old "companyId_1" index.');
    } else {
      console.log('Old "companyId_1" index not found on LeavePolicy collection. No action needed.');
    }

    // Drop old employeeId_1 index from LeaveEntitlement collection
    const leaveEntitlementIndexes = await LeaveEntitlement.collection.getIndexes();
    if (leaveEntitlementIndexes.employeeId_1) {
      console.log('Detected old "employeeId_1" index on LeaveEntitlement collection. Dropping...');
      await LeaveEntitlement.collection.dropIndex('employeeId_1');
      console.log('Successfully dropped old "employeeId_1" index.');
    } else {
      console.log('Old "employeeId_1" index not found on LeaveEntitlement collection. No action needed.');
    }

  } catch (error) {
    console.error('Error during old index migration:', error);
  }
}

module.exports = dropOldIndexes;