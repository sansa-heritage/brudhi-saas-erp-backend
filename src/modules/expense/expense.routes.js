const express = require('express');
const router = express.Router();
const ExpenseController = require('./expense.controller');
const AuthMiddleware = require('../../middlewares/auth.middleware');
const TenantMiddleware = require('../../middlewares/tenant.middleware');

router.use(AuthMiddleware.authenticate);
router.use(TenantMiddleware.setTenantContext);
router.use(TenantMiddleware.cleanupTenantDb);

router.get('/', ExpenseController.getAllExpenses);
router.get('/categories', ExpenseController.getExpenseCategories);
router.get('/:id', ExpenseController.getExpenseById);
router.post('/', ExpenseController.createExpense);
router.put('/:id', ExpenseController.updateExpense);
router.delete('/:id', ExpenseController.deleteExpense);

module.exports = router;