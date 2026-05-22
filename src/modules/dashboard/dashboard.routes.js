const express = require('express');
const router = express.Router();
const DashboardController = require('./dashboard.controller');
const AuthMiddleware = require('../../middlewares/auth.middleware');
const TenantMiddleware = require('../../middlewares/tenant.middleware');

router.use(AuthMiddleware.authenticate);
router.use(TenantMiddleware.setTenantContext);
router.use(TenantMiddleware.cleanupTenantDb);

router.get('/stats', DashboardController.getStats);
router.get('/charts', DashboardController.getCharts);

module.exports = router;