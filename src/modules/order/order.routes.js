const express = require("express");
const router = express.Router();
const OrderController = require("./order.controller");
const AuthMiddleware = require("../../middlewares/auth.middleware");
const TenantMiddleware = require("../../middlewares/tenant.middleware");

// Apply middleware
router.use(AuthMiddleware.authenticate);
router.use(TenantMiddleware.setTenantContext);
router.use(TenantMiddleware.cleanupTenantDb);

// Order routes
router.post("/", OrderController.createOrder);
router.get("/", OrderController.getAllOrders);
router.get("/statistics", OrderController.getOrderStatistics);
router.get("/:id", OrderController.getOrderById);
router.put("/:id/status", OrderController.updateOrderStatus);
router.put("/:id/payment", OrderController.updatePaymentStatus);
router.post("/:id/cancel", OrderController.cancelOrder);
router.delete("/:id", OrderController.deleteOrder);
router.put('/:id', OrderController.updateOrder);         // ✅ PUT /api/orders/:id - ADD THIS


module.exports = router;
