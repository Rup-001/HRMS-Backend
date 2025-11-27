const ShiftTemplate = require('../models/shiftTemplate');
const Shift = require('../models/shift');

// @desc    Create a new shift template
// @route   POST /api/shifttemplates
// @access  Private (Admin/HR Manager)
exports.createShiftTemplate = async (req, res) => {
  try {
    const { code, label, onSiteHours, remoteHours, onSiteShiftId, description, isOff } = req.body;
    const { companyId } = req.user;

    const template = new ShiftTemplate({
      companyId,
      code,
      label,
      onSiteHours,
      remoteHours,
      onSiteShiftId,
      description,
      isOff
    });

    const createdTemplate = await template.save();
    res.status(201).json({ success: true, data: createdTemplate });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: 'A shift template with this code already exists.' });
    }
    res.status(400).json({ success: false, error: error.message });
  }
};

// @desc    Get all shift templates for the company
// @route   GET /api/shifttemplates
// @access  Private
exports.getShiftTemplates = async (req, res) => {
  try {
    const templates = await ShiftTemplate.find({ companyId: req.user.companyId }).populate('onSiteShiftId', 'name startTime endTime');
    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// @desc    Update a shift template
// @route   PUT /api/shifttemplates/:id
// @access  Private (Admin/HR Manager)
exports.updateShiftTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, label, onSiteHours, remoteHours, onSiteShiftId, description, isOff } = req.body;

    const template = await ShiftTemplate.findById(id);

    if (!template) {
      return res.status(404).json({ success: false, error: 'Shift template not found' });
    }

    // Check ownership
    if (template.companyId.toString() !== req.user.companyId.toString()) {
        return res.status(403).json({ success: false, error: 'Not authorized to update this template' });
    }

    template.code = code || template.code;
    template.label = label || template.label;
    template.onSiteHours = onSiteHours !== undefined ? onSiteHours : template.onSiteHours;
    template.remoteHours = remoteHours !== undefined ? remoteHours : template.remoteHours;
    template.onSiteShiftId = onSiteShiftId || template.onSiteShiftId;
    template.description = description || template.description;
    template.isOff = isOff !== undefined ? isOff : template.isOff;

    const updatedTemplate = await template.save();
    res.status(200).json({ success: true, data: updatedTemplate });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: 'A shift template with this code already exists.' });
    }
    res.status(400).json({ success: false, error: error.message });
  }
};

// @desc    Delete a shift template
// @route   DELETE /api/shifttemplates/:id
// @access  Private (Admin/HR Manager)
exports.deleteShiftTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await ShiftTemplate.findById(id);

    if (!template) {
      return res.status(404).json({ success: false, error: 'Shift template not found' });
    }

    // Check ownership
    if (template.companyId.toString() !== req.user.companyId.toString()) {
        return res.status(403).json({ success: false, error: 'Not authorized to delete this template' });
    }

    await template.remove();
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};
