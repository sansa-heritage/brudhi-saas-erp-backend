// routes/dashboard.routes.js
const express = require('express');
const router = express.Router();
const DashboardController = require('./dashboard.controller');
const AuthMiddleware = require('../../middlewares/auth.middleware');
const TenantMiddleware = require('../../middlewares/tenant.middleware');

router.use(AuthMiddleware.authenticate);
router.use(TenantMiddleware.setTenantContext);
router.use(TenantMiddleware.cleanupTenantDb);

// Dashboard endpoints
router.get('/stats', DashboardController.getStats);
router.get('/charts', DashboardController.getCharts);
router.get('/sales-data', DashboardController.getSalesData);
router.get('/recent-invoices', DashboardController.getRecentInvoices);
router.get('/customers', DashboardController.getCustomerOverview);
router.get('/expenses', DashboardController.getExpenseSummary);

module.exports = router;