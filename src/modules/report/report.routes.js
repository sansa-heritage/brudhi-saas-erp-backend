const express = require('express');
const router = express.Router();
const ReportController = require('./report.controller');
const AuthMiddleware = require('../../middlewares/auth.middleware');
const TenantMiddleware = require('../../middlewares/tenant.middleware');

router.use(AuthMiddleware.authenticate);
router.use(TenantMiddleware.setTenantContext);
router.use(TenantMiddleware.cleanupTenantDb);

// Dashboard summary endpoint
router.get('/dashboard-summary', ReportController.getDashboardSummary);

// Report endpoints
router.get('/sales', ReportController.getSalesReport);
router.get('/stock', ReportController.getStockReport);
router.get('/financial', ReportController.getFinancialReport);
router.get('/customer/:customerId', ReportController.getCustomerReport);

// Export endpoints
router.get('/export/sales', ReportController.exportSalesReport);
router.get('/export/expenses', ReportController.exportExpensesReport);
router.get('/export/financial', ReportController.exportFinancialReport);
router.get('/export/customer/:customerId', ReportController.exportCustomerReport); // Added customer

module.exports = router;