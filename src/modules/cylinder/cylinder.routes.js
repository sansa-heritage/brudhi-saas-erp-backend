const express = require("express");
// const router = express.Router();
// const CylinderController = require("./cylinder.controller");
// const AuthMiddleware = require("../../middlewares/auth.middleware");
// const TenantMiddleware = require("../../middlewares/tenant.middleware");

const router = express.Router();
const CylinderController = require('./cylinder.controller');
const AuthMiddleware = require('../../middlewares/auth.middleware');
const TenantMiddleware = require('../../middlewares/tenant.middleware');


// Apply middleware
router.use(AuthMiddleware.authenticate);
router.use(TenantMiddleware.setTenantContext);
router.use(TenantMiddleware.cleanupTenantDb);

// ==================== CYLINDER TYPES ROUTES ====================
router.get("/types", CylinderController.getCylinderTypes);
router.get("/types/:id", CylinderController.getCylinderTypeById);
router.post("/types", CylinderController.createCylinderType);
router.put("/types/:id", CylinderController.updateCylinderType);
router.delete("/types/:id", CylinderController.deleteCylinderType);
router.get("/types/stats", CylinderController.getCylinderTypeStats);

// ==================== CYLINDER STOCK ROUTES ====================
router.get("/stock", CylinderController.getCylinders);
router.get("/stock/:id", CylinderController.getCylinderById);
router.post("/stock", CylinderController.createCylinder);
router.put("/stock/:id", CylinderController.updateCylinder);
router.delete("/stock/:id", CylinderController.deleteCylinder);
router.patch("/stock/:id/status", CylinderController.updateCylinderStatus);
router.get("/stock/type/:typeId", CylinderController.getCylindersByType);

// ==================== LOW STOCK ALERTS ROUTES ====================
router.get("/low-stock", CylinderController.getLowStockAlerts);
router.get("/low-stock/threshold", CylinderController.getLowStockThreshold);
router.put("/low-stock/threshold", CylinderController.updateLowStockThreshold);

// ==================== STOCK TRANSACTIONS ROUTES ====================
router.get("/transactions", CylinderController.getStockTransactions);
router.get("/transactions/:id", CylinderController.getStockTransactionById);
router.post("/transactions", CylinderController.createStockTransaction);
router.get("/transactions/cylinder/:cylinderId", CylinderController.getStockTransactionsByCylinder);

// ==================== STATISTICS ROUTES ====================
router.get("/statistics", CylinderController.getStockStatistics);

module.exports = router;