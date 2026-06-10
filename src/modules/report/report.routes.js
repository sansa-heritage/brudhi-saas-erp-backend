// const express = require('express');
// const router = express.Router();
// const ReportController = require('./report.controller');
// const AuthMiddleware = require('../../middlewares/auth.middleware');
// const TenantMiddleware = require('../../middlewares/tenant.middleware');

// router.use(AuthMiddleware.authenticate);
// router.use(TenantMiddleware.setTenantContext);
// router.use(TenantMiddleware.cleanupTenantDb);

// // Dashboard summary endpoint
// router.get('/dashboard-summary', ReportController.getDashboardSummary);

// // Report endpoints
// router.get('/sales', ReportController.getSalesReport);
// router.get('/stock', ReportController.getStockReport);
// router.get('/financial', ReportController.getFinancialReport);
// router.get('/customer/:customerId', ReportController.getCustomerReport);

// // Export endpoints
// // Sales Report Routes
// router.get('/export/sales', ReportController.exportSalesReport);
// // router.get("/reports/sales", ReportController.exportSalesReport);
// router.get('/export/expenses', ReportController.exportExpensesReport);
// router.get('/export/financial', ReportController.exportFinancialReport);
// router.get('/export/customer/:customerId', ReportController.exportCustomerReport); // Added customer

// module.exports = router;

const express = require('express');
const router = express.Router();
const ReportController = require('./report.controller');
const AuthMiddleware = require('../../middlewares/auth.middleware');
const TenantMiddleware = require('../../middlewares/tenant.middleware');

// ==================== EXPORT ROUTES (DEFINE FIRST) ====================
// Sales Report Export Routes with manual tenant ID handling
router.get('/export/sales', async (req, res, next) => {
  try {
    // Get tenant ID from header or query parameter
    req.tenantId = req.headers['x-tenant-id'] || req.query.tenantId;
    
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required. Please provide X-tenant-id header or tenantId query parameter'
      });
    }
    
    await ReportController.exportSalesReport(req, res);
  } catch (error) {
    next(error);
  }
});

router.get('/export/expenses', async (req, res, next) => {
  try {
    req.tenantId = req.headers['x-tenant-id'] || req.query.tenantId;
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }
    await ReportController.exportExpensesReport(req, res);
  } catch (error) {
    next(error);
  }
});

router.get('/export/financial', async (req, res, next) => {
  try {
    req.tenantId = req.headers['x-tenant-id'] || req.query.tenantId;
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }
    await ReportController.exportFinancialReport(req, res);
  } catch (error) {
    next(error);
  }
});

router.get('/export/customer/:customerId', async (req, res, next) => {
  try {
    req.tenantId = req.headers['x-tenant-id'] || req.query.tenantId;
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }
    await ReportController.exportCustomerReport(req, res);
  } catch (error) {
    next(error);
  }
});

// ==================== PROTECTED ROUTES ====================
// Apply authentication middleware for all routes below this line
router.use(AuthMiddleware.authenticate);
router.use(TenantMiddleware.setTenantContext);
router.use(TenantMiddleware.cleanupTenantDb);

// Dashboard summary endpoint
router.get('/dashboard-summary', ReportController.getDashboardSummary);

// Report endpoints (JSON data)
router.get('/sales', ReportController.getSalesReport);
router.get('/stock', ReportController.getStockReport);
router.get('/financial', ReportController.getFinancialReport);
router.get('/customer/:customerId', ReportController.getCustomerReport);

// Test route to verify routing is working
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Report routes working!',
    tenantId: req.tenantId 
  });
});

module.exports = router;