const Designation = require('../models/designation');

exports.createDesignation = async (req, res) => {
  try {
    const { name, department } = req.body;
    if (!name || !department) {
      return res.status(400).json({ success: false, error: 'Designation name and department are required' });
    }
    const designation = new Designation({ name, department });
    await designation.save();
    res.status(201).json({ success: true, data: designation });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getDesignations = async (req, res) => {
  try {
    const designations = await Designation.find({ isActive: true }).populate('department');
    res.status(200).json({ success: true, data: designations });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getDesignationsByDepartment = async (req, res) => {
    try {
        const { departmentId } = req.params;
        const designations = await Designation.find({ department: departmentId, isActive: true });
        res.status(200).json({ success: true, data: designations });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};