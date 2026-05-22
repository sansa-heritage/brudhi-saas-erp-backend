const express = require('express');
const router = express.Router();
const TenantController = require('./tenant.controller');
const AuthMiddleware = require('../../middlewares/auth.middleware');
const TenantMiddleware = require('../../middlewares/tenant.middleware');

router.use(AuthMiddleware.authenticate);
router.use(TenantMiddleware.setTenantContext);
router.use(TenantMiddleware.cleanupTenantDb);

router.get('/info', TenantController.getTenantInfo);
router.get('/settings', TenantController.getSettings);
router.put('/settings', TenantController.updateSettings);
router.get('/modules', TenantController.getModules);
router.put('/modules', TenantController.updateModule);

module.exports = router;