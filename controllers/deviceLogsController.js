const zkService = require("../services/zktecoService");

exports.testConnection = async (req, res) => {
  const result = await zkService.testConnection();
  res.json(result);
};

// Sync users from device to DB
exports.syncUsers = async (req, res) => {
  try {
    const result = await zkService.syncUsers();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Sync attendance logs
exports.syncLogs = async (req, res) => {
  try {
    const result = await zkService.syncDeviceLogs();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { userid, name } = req.body;
    if (!userid || !name) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Missing required parameters: userid, name",
        });
    }
    const result = await zkService.setUser(userid, name);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
