const express = require('express');
const router = express.Router();
const CustomerController = require('./customer.controller');
const AuthMiddleware = require('../../middlewares/auth.middleware');
const TenantMiddleware = require('../../middlewares/tenant.middleware');

// All routes require authentication and tenant context
router.use(AuthMiddleware.authenticate);
router.use(TenantMiddleware.setTenantContext);
router.use(TenantMiddleware.cleanupTenantDb);

router.get('/', CustomerController.getAllCustomers);
router.get('/:id', CustomerController.getCustomerById);
router.post('/', CustomerController.createCustomer);
router.put('/:id', CustomerController.updateCustomer);
router.delete('/:id', CustomerController.deleteCustomer);

module.exports = router;