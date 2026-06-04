// const express = require("express");
// const router = express.Router();
// const InvoiceController = require("./invoice.controller");
// const AuthMiddleware = require("../../middlewares/auth.middleware");
// const TenantMiddleware = require("../../middlewares/tenant.middleware");

// router.use(AuthMiddleware.authenticate);
// router.use(TenantMiddleware.setTenantContext);
// router.use(TenantMiddleware.cleanupTenantDb);

// router.get("/", InvoiceController.getAllInvoices);
// router.get("/:id", InvoiceController.getInvoiceById);
// router.post("/", InvoiceController.createInvoice);
// router.put("/:id", InvoiceController.updateInvoice);
// router.delete("/:id", InvoiceController.deleteInvoice);
// router.post("/:id/payments", InvoiceController.recordPayment);
// // GENERATE INVOICE IN DIFFERENT FORMATS
// // In invoice.routes.js
// router.get('/:id/download', AuthMiddleware.authenticate, InvoiceController.downloadInvoice);

// module.exports = router;

const express = require("express");
const router = express.Router();
const InvoiceController = require("./invoice.controller");
const AuthMiddleware = require("../../middlewares/auth.middleware");
const TenantMiddleware = require("../../middlewares/tenant.middleware");

// Middleware
router.use(
  AuthMiddleware.authenticate,
  TenantMiddleware.setTenantContext,
  TenantMiddleware.cleanupTenantDb,
);

// Routes
router.get("/download/:id", InvoiceController.downloadInvoice);
router.get("/generate/:id", InvoiceController.generateInvoice);
router.get("/", InvoiceController.getAllInvoices);
router.get("/:id", InvoiceController.getInvoiceById);
router.post("/", InvoiceController.createInvoice);
router.put("/:id", InvoiceController.updateInvoice);
router.delete("/:id", InvoiceController.deleteInvoice);
router.post("/:id/payments", InvoiceController.recordPayment);

module.exports = router;
