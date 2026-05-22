const express = require('express');
const router = express.Router();
const InventoryController = require('./inventory.controller');
const AuthMiddleware = require('../../middlewares/auth.middleware');
const TenantMiddleware = require('../../middlewares/tenant.middleware');

// Apply middleware
router.use(AuthMiddleware.authenticate);
router.use(TenantMiddleware.setTenantContext);
router.use(TenantMiddleware.cleanupTenantDb);

// =============================================
// PRODUCT MANAGEMENT
// =============================================
router.post('/', InventoryController.createProduct);
router.get('/', InventoryController.getAllProducts);


// =============================================
// STOCK MANAGEMENT
// =============================================
router.post('/stock/transactions', InventoryController.addStockTransaction);
router.get('/stock/transactions/:productId', InventoryController.getStockTransactions);
router.post('/stock/adjust', InventoryController.adjustStock);

// =============================================
// STOCK ALERTS
// =============================================
router.get('/alerts', InventoryController.getActiveAlerts);
router.put('/alerts/:id/resolve', InventoryController.resolveAlert);

// =============================================
// STOCK TRANSFERS
// =============================================
router.post('/transfers', InventoryController.createStockTransfer);
router.put('/transfers/:id/complete', InventoryController.completeStockTransfer);

// =============================================
// INVENTORY REPORTS
// =============================================
router.get('/summary', InventoryController.getInventorySummary);

router.get('/:id', InventoryController.getProductById);
router.put('/:id', InventoryController.updateProduct);
router.delete('/:id', InventoryController.deleteProduct);

module.exports = router;