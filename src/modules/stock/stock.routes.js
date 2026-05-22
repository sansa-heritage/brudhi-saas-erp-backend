const express = require('express');
const router = express.Router();
const StockController = require('./stock.controller');
const AuthMiddleware = require('../../middlewares/auth.middleware');
const TenantMiddleware = require('../../middlewares/tenant.middleware');

router.use(AuthMiddleware.authenticate);
router.use(TenantMiddleware.setTenantContext);
router.use(TenantMiddleware.cleanupTenantDb);

router.get('/', StockController.getAllStock);
router.get('/:id', StockController.getStockById);
router.get('/:stockId/transactions', StockController.getStockTransactions);
router.post('/', StockController.createStock);
router.put('/:id', StockController.updateStock);
router.delete('/:id', StockController.deleteStock);

module.exports = router;