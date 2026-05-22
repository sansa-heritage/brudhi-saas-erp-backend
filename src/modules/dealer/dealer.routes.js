const express = require('express');
const router = express.Router();
const DealerController = require('./dealer.controller');
const AuthMiddleware = require('../../middlewares/auth.middleware');
const TenantMiddleware = require('../../middlewares/tenant.middleware');

router.use(AuthMiddleware.authenticate);
router.use(TenantMiddleware.setTenantContext);
router.use(TenantMiddleware.cleanupTenantDb);

router.get('/', DealerController.getAllDealers);
router.get('/:id', DealerController.getDealerById);
router.post('/', DealerController.createDealer);
router.put('/:id', DealerController.updateDealer);
router.delete('/:id', DealerController.deleteDealer);

module.exports = router;