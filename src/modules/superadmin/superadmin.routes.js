const express = require('express');
const router = express.Router();
const SuperadminController = require('./superadmin.controller');
const AuthMiddleware = require('../../middlewares/auth.middleware');

// All routes require authentication and superadmin role
router.use(AuthMiddleware.authenticate);
router.use(AuthMiddleware.authorize('superadmin'));

// ==================== TENANT MANAGEMENT ====================
router.get('/tenants', SuperadminController.getAllTenants);
router.get('/tenants/:id', SuperadminController.getTenantById);
router.post('/tenants', SuperadminController.createTenant);
router.put('/tenants/:id', SuperadminController.updateTenant);
router.delete('/tenants/:id', SuperadminController.deleteTenant);
router.patch('/tenants/:id/status', SuperadminController.updateTenantStatus);

// ==================== TENANT DATABASE MANAGEMENT ====================
router.get('/tenants/:id/database', SuperadminController.getTenantDatabaseInfo);
router.post('/tenants/:id/backup', SuperadminController.backupTenantDatabase);

// ==================== TENANT SUBSCRIPTION MANAGEMENT ====================
router.get('/tenants/:id/subscription', SuperadminController.getTenantSubscription);
router.patch('/tenants/:id/subscription', SuperadminController.assignPlanToTenant);
router.get('/tenants/:id/subscription/history', SuperadminController.getTenantSubscriptionHistory);
router.post('/tenants/:id/subscription/cancel', SuperadminController.cancelTenantSubscription);
router.patch('/tenants/:id/subscription/update', SuperadminController.updateTenantSubscription);

// ==================== SUBSCRIPTION MANAGEMENT (ALL TENANTS) ====================
// Get all subscriptions across all tenants
router.get('/subscriptions', SuperadminController.getAllSubscriptions);

// Get subscription statistics
router.get('/subscriptions/stats', SuperadminController.getSubscriptionStats);

// Get subscriptions by plan
router.get('/subscriptions/plan/:planId', SuperadminController.getSubscriptionsByPlan);

// Get expiring subscriptions
router.get('/subscriptions/expiring', SuperadminController.getExpiringSubscriptions);

// Get expired subscriptions
router.get('/subscriptions/expired', SuperadminController.getExpiredSubscriptions);

// Bulk assign plan to multiple tenants
router.post('/subscriptions/bulk-assign', SuperadminController.bulkAssignPlan);

module.exports = router;