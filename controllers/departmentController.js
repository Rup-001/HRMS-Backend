const Department = require('../models/department');

exports.createDepartment = async (req, res) => {
  try {
    const { name, company } = req.body;
    if (!name || !company) {
      return res.status(400).json({ success: false, error: 'Department name and company are required' });
    }
    const department = new Department({ name, company });
    await department.save();
    res.status(201).json({ success: true, data: department });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getDepartments = async (req, res) => {
  try {
    const departments = await Department.find({ isActive: true }).populate('company');
    res.status(200).json({ success: true, data: departments });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getDepartmentsByCompany = async (req, res) => {
    try {
        const { companyId } = req.params;
        const departments = await Department.find({ company: companyId, isActive: true });
        res.status(200).json({ success: true, data: departments });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};