// src/modules/cylinder/cylinder.controller.js
const cylinderService = require("./cylinder.service");

// ==================== CYLINDER TYPES ====================
const getCylinderTypes = async (req, res) => {
  try {
    const types = await cylinderService.getCylinderTypes(req.tenantId);
    res.json({ success: true, data: types });
  } catch (error) {
    console.error("Error in getCylinderTypes:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getCylinderTypeById = async (req, res) => {
  try {
    const type = await cylinderService.getCylinderTypeById(req.params.id, req.tenantId);
    if (!type) {
      return res.status(404).json({ success: false, message: "Cylinder type not found" });
    }
    res.json({ success: true, data: type });
  } catch (error) {
    console.error("Error in getCylinderTypeById:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const createCylinderType = async (req, res) => {
  try {
    const type = await cylinderService.createCylinderType(req.body, req.tenantId, req.user.id);
    res.status(201).json({ success: true, data: type, message: "Cylinder type created successfully" });
  } catch (error) {
    console.error("Error in createCylinderType:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateCylinderType = async (req, res) => {
  try {
    const type = await cylinderService.updateCylinderType(req.params.id, req.body, req.tenantId);
    if (!type) {
      return res.status(404).json({ success: false, message: "Cylinder type not found" });
    }
    res.json({ success: true, data: type, message: "Cylinder type updated successfully" });
  } catch (error) {
    console.error("Error in updateCylinderType:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteCylinderType = async (req, res) => {
  try {
    await cylinderService.deleteCylinderType(req.params.id, req.tenantId);
    res.json({ success: true, message: "Cylinder type deleted successfully" });
  } catch (error) {
    console.error("Error in deleteCylinderType:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getCylinderTypeStats = async (req, res) => {
  try {
    const stats = await cylinderService.getCylinderTypeStats(req.tenantId);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error("Error in getCylinderTypeStats:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== CYLINDER STOCK ====================
const getCylinders = async (req, res) => {
  try {
    const cylinders = await cylinderService.getCylinders(req.tenantId);
    res.json({ success: true, data: cylinders });
  } catch (error) {
    console.error("Error in getCylinders:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getCylinderById = async (req, res) => {
  try {
    const cylinder = await cylinderService.getCylinderById(req.params.id, req.tenantId);
    if (!cylinder) {
      return res.status(404).json({ success: false, message: "Cylinder not found" });
    }
    res.json({ success: true, data: cylinder });
  } catch (error) {
    console.error("Error in getCylinderById:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const createCylinder = async (req, res) => {
  try {
    const cylinder = await cylinderService.createCylinder(req.body, req.tenantId, req.user.id);
    res.status(201).json({ success: true, data: cylinder, message: "Cylinder created successfully" });
  } catch (error) {
    console.error("Error in createCylinder:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateCylinder = async (req, res) => {
  try {
    const cylinder = await cylinderService.updateCylinder(req.params.id, req.body, req.tenantId);
    if (!cylinder) {
      return res.status(404).json({ success: false, message: "Cylinder not found" });
    }
    res.json({ success: true, data: cylinder, message: "Cylinder updated successfully" });
  } catch (error) {
    console.error("Error in updateCylinder:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteCylinder = async (req, res) => {
  try {
    await cylinderService.deleteCylinder(req.params.id, req.tenantId);
    res.json({ success: true, message: "Cylinder deleted successfully" });
  } catch (error) {
    console.error("Error in deleteCylinder:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateCylinderStatus = async (req, res) => {
  try {
    const cylinder = await cylinderService.updateCylinderStatus(req.params.id, req.body.status, req.tenantId);
    res.json({ success: true, data: cylinder, message: "Cylinder status updated successfully" });
  } catch (error) {
    console.error("Error in updateCylinderStatus:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getCylindersByType = async (req, res) => {
  try {
    const cylinders = await cylinderService.getCylindersByType(req.params.typeId, req.tenantId);
    res.json({ success: true, data: cylinders });
  } catch (error) {
    console.error("Error in getCylindersByType:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== LOW STOCK ALERTS ====================
const getLowStockAlerts = async (req, res) => {
  try {
    const alerts = await cylinderService.getLowStockAlerts(req.tenantId);
    res.json({ success: true, data: alerts });
  } catch (error) {
    console.error("Error in getLowStockAlerts:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getLowStockThreshold = async (req, res) => {
  try {
    const threshold = await cylinderService.getLowStockThreshold(req.tenantId);
    res.json({ success: true, data: { threshold } });
  } catch (error) {
    console.error("Error in getLowStockThreshold:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateLowStockThreshold = async (req, res) => {
  try {
    const threshold = await cylinderService.updateLowStockThreshold(req.body.threshold, req.tenantId);
    res.json({ success: true, data: { threshold }, message: "Threshold updated successfully" });
  } catch (error) {
    console.error("Error in updateLowStockThreshold:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== STOCK TRANSACTIONS ====================
const getStockTransactions = async (req, res) => {
  try {
    const transactions = await cylinderService.getStockTransactions(req.tenantId);
    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error("Error in getStockTransactions:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getStockTransactionById = async (req, res) => {
  try {
    const transaction = await cylinderService.getStockTransactionById(req.params.id, req.tenantId);
    if (!transaction) {
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }
    res.json({ success: true, data: transaction });
  } catch (error) {
    console.error("Error in getStockTransactionById:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const createStockTransaction = async (req, res) => {
  try {
    const transaction = await cylinderService.createStockTransaction(req.body, req.tenantId, req.user.id);
    res.status(201).json({ success: true, data: transaction, message: "Transaction created successfully" });
  } catch (error) {
    console.error("Error in createStockTransaction:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getStockTransactionsByCylinder = async (req, res) => {
  try {
    const transactions = await cylinderService.getStockTransactionsByCylinder(req.params.cylinderId, req.tenantId);
    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error("Error in getStockTransactionsByCylinder:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== STATISTICS ====================
const getStockStatistics = async (req, res) => {
  try {
    const stats = await cylinderService.getStockStatistics(req.tenantId);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error("Error in getStockStatistics:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== EXPORTS ====================
module.exports = {
  getCylinderTypes,
  getCylinderTypeById,
  createCylinderType,
  updateCylinderType,
  deleteCylinderType,
  getCylinderTypeStats,
  getCylinders,
  getCylinderById,
  createCylinder,
  updateCylinder,
  deleteCylinder,
  updateCylinderStatus,
  getCylindersByType,
  getLowStockAlerts,
  getLowStockThreshold,
  updateLowStockThreshold,
  getStockTransactions,
  getStockTransactionById,
  createStockTransaction,
  getStockTransactionsByCylinder,
  getStockStatistics
};