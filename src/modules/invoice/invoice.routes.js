const express = require("express");
const router = express.Router();
const InvoiceController = require("./invoice.controller");
const AuthMiddleware = require("../../middlewares/auth.middleware");
const TenantMiddleware = require("../../middlewares/tenant.middleware");

router.use(AuthMiddleware.authenticate);
router.use(TenantMiddleware.setTenantContext);
router.use(TenantMiddleware.cleanupTenantDb);

router.get("/", InvoiceController.getAllInvoices);
router.get("/:id", InvoiceController.getInvoiceById);
router.post("/", InvoiceController.createInvoice);
router.put("/:id", InvoiceController.updateInvoice);
router.delete("/:id", InvoiceController.deleteInvoice);
router.post("/:id/payments", InvoiceController.recordPayment);
// GENERATE INVOICE IN DIFFERENT FORMATS
// In invoice.routes.js
router.get('/:id/download', AuthMiddleware.authenticate, InvoiceController.downloadInvoice);



module.exports = router;
