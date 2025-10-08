const Company = require('../models/company');

exports.createCompany = async (req, res) => {
  let company = null;

  try {
    console.log('createCompany - Request body:', req.body);

    const { name } = req.body;

    if (!name) {
      throw new Error('Company name is required');
    }

    if (await Company.findOne({ name })) {
      throw new Error('Company name must be unique');
    }

    company = new Company({
      name,
      isActive: true
    });

    await company.save();
    console.log('createCompany - Saved company:', { _id: company._id, name: company.name, isActive: company.isActive });

    res.status(201).json({ success: true, data: company });
  } catch (error) {
    console.error('createCompany - Error:', error);
    if (company) {
      await Company.deleteOne({ _id: company._id });
      console.log('createCompany - Rolled back company:', company._id);
    }
    res.status(400).json({ success: false, error: error.message });
  } finally {
    console.log('createCompany - Execution completed');
  }
};

exports.getCompanies = async (req, res) => {
  try {
    const companies = await Company.find({ isActive: true });
    console.log('getCompanies - Retrieved companies:', companies.map(c => ({
      _id: c._id,
      name: c.name,
      isActive: c.isActive
    })));

    res.status(200).json({ success: true, data: companies });
  } catch (error) {
    console.error('getCompanies - Error:', error);
    res.status(400).json({ success: false, error: error.message });
  } finally {
    console.log('getCompanies - Execution completed');
  }
};