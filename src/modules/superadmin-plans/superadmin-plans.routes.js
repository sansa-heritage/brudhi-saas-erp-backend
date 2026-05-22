const express = require('express');
const router = express.Router();
const SuperadminPlansController = require('./superadmin-plans.controller');
const AuthMiddleware = require('../../middlewares/auth.middleware');

// All routes require superadmin authentication
router.use(AuthMiddleware.authenticate);
router.use(AuthMiddleware.authorize('superadmin'));

// Plan Management
router.get('/', SuperadminPlansController.getAllPlans);
router.get('/:id', SuperadminPlansController.getPlanById);
router.post('/', SuperadminPlansController.createPlan);
router.put('/:id', SuperadminPlansController.updatePlan);
router.patch('/:id/status', SuperadminPlansController.togglePlanStatus);
router.delete('/:id', SuperadminPlansController.deletePlan);

module.exports = router;