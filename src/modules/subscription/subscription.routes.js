const express = require('express');
const router = express.Router();
const SubscriptionController = require('./subscription.controller');
const AuthMiddleware = require('../../middlewares/auth.middleware');
const TenantMiddleware = require('../../middlewares/tenant.middleware');

// Apply middleware
router.use(AuthMiddleware.authenticate);
router.use(TenantMiddleware.setTenantContext);
router.use(TenantMiddleware.cleanupTenantDb);

// Subscription routes
router.post('/', SubscriptionController.createSubscription);
router.get('/', SubscriptionController.getAllSubscriptions);
router.get('/statistics', SubscriptionController.getSubscriptionStatistics);
router.get('/tenant', SubscriptionController.getTenantSubscription);
router.get('/:id', SubscriptionController.getSubscriptionById);
router.post('/:id/renew', SubscriptionController.renewSubscription);
router.post('/:id/cancel', SubscriptionController.cancelSubscription);
router.post('/:id/payments', SubscriptionController.recordPayment);
router.post('/update-expired', SubscriptionController.updateExpiredSubscriptions);

module.exports = router;