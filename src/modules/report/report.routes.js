const express = require('express');
const router = express.Router();
const ReportController = require('./report.controller');
const AuthMiddleware = require('../../middlewares/auth.middleware');
const TenantMiddleware = require('../../middlewares/tenant.middleware');

router.use(AuthMiddleware.authenticate);
router.use(TenantMiddleware.setTenantContext);
router.use(TenantMiddleware.cleanupTenantDb);

router.get('/dashboard', ReportController.getDashboardSummary);
router.get('/sales', ReportController.getSalesReport);
router.get('/stock', ReportController.getStockReport);
router.get('/financial', ReportController.getFinancialReport);
router.get('/customer/:customerId', ReportController.getCustomerReport);

module.exports = router;