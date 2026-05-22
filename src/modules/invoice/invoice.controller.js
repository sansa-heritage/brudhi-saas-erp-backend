const InvoiceService = require("./invoice.service");
const ResponseUtil = require("../../utils/response");
const logger = require("../../config/logger");

class InvoiceController {
  async getAllInvoices(req, res) {
    try {
      const filters = {
        partyType: req.query.partyType,
        paymentStatus: req.query.paymentStatus,
        fromDate: req.query.fromDate,
        toDate: req.query.toDate,
        page: req.query.page,
        limit: req.query.limit,
      };

      const result = await InvoiceService.getAllInvoices(req.tenantId, filters);
      return ResponseUtil.success(res, result, "Invoices fetched successfully");
    } catch (error) {
      logger.error("Get all invoices error:", error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  // ✅ FIXED: Get invoice by ID - returns single object
  async getInvoiceById(req, res) {
    try {
      const id = Number(req.params.id);

      if (!id || isNaN(id)) {
        return ResponseUtil.error(res, "Invalid invoice ID", 400);
      }

      const invoice = await InvoiceService.getInvoiceById(req.tenantId, id);

      if (!invoice) {
        return ResponseUtil.notFound(res, "Invoice not found");
      }

      return ResponseUtil.success(res, invoice, "Invoice fetched successfully");
    } catch (error) {
      logger.error("Get invoice by id error:", error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  async createInvoice(req, res) {
    try {
      const tenantId = Number(req.tenantId);

      if (!tenantId || isNaN(tenantId)) {
        return ResponseUtil.error(res, "Invalid tenant ID", 400);
      }

      const invoiceData = {
        partyType: req.body.partyType,
        partyId: req.body.partyId,
        partyName: req.body.partyName,
        partyGst: req.body.partyGst,
        partyAddress: req.body.partyAddress,
        invoiceDate: req.body.invoiceDate,
        dueDate: req.body.dueDate,
        discountType: req.body.discountType,
        discountValue: req.body.discountValue,
        discountAmount: req.body.discountAmount,
        roundOff: req.body.roundOff,
        paymentStatus: req.body.paymentStatus,
        paidAmount: req.body.paidAmount,
        paymentMethod: req.body.paymentMethod,
        transactionId: req.body.transactionId,
        notes: req.body.notes,
        termsConditions: req.body.termsConditions,
        createdBy: req.user?.id || req.body.createdBy,
      };

      const items = req.body.items;

      if (!invoiceData.partyType) {
        return ResponseUtil.error(res, "partyType is required", 400);
      }
      if (!invoiceData.partyId) {
        return ResponseUtil.error(res, "partyId is required", 400);
      }
      if (!invoiceData.partyName) {
        return ResponseUtil.error(res, "partyName is required", 400);
      }
      if (!items || !Array.isArray(items) || items.length === 0) {
        return ResponseUtil.error(res, "items array is required", 400);
      }

      const invoiceId = await InvoiceService.createInvoice(
        tenantId,
        invoiceData,
        items,
      );

      const invoice = await InvoiceService.getInvoiceById(tenantId, invoiceId);

      return ResponseUtil.created(res, invoice, "Invoice created successfully");
    } catch (error) {
      logger.error("Create invoice error:", error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  async recordPayment(req, res) {
    try {
      const paymentData = { ...req.body, receivedBy: req.user.id };
      await InvoiceService.recordPayment(req.tenantId, paymentData);
      const invoice = await InvoiceService.getInvoiceById(
        req.tenantId,
        paymentData.invoiceId,
      );
      return ResponseUtil.success(
        res,
        invoice,
        "Payment recorded successfully",
      );
    } catch (error) {
      logger.error("Record payment error:", error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  // ✅ FIXED: Update invoice
  async updateInvoice(req, res) {
    try {
      const id = Number(req.params.id);

      if (!id || isNaN(id)) {
        return ResponseUtil.error(res, "Invalid invoice ID", 400);
      }

      const existingInvoice = await InvoiceService.getInvoiceById(
        req.tenantId,
        id,
      );

      if (!existingInvoice) {
        return ResponseUtil.notFound(res, "Invoice not found");
      }

      await InvoiceService.updateInvoice(req.tenantId, id, req.body);
      const invoice = await InvoiceService.getInvoiceById(req.tenantId, id);

      return ResponseUtil.success(res, invoice, "Invoice updated successfully");
    } catch (error) {
      logger.error("Update invoice error:", error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  // Delete invoice (hard delete)
  // In invoice.controller.js
  async deleteInvoice(req, res) {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      const invoiceId = req.params.id;

      console.log("=== DELETE INVOICE CONTROLLER ===");
      console.log("Tenant ID:", tenantId);
      console.log("Invoice ID:", invoiceId);

      // Validate invoice ID
      if (!invoiceId || isNaN(invoiceId)) {
        return res.status(400).json({
          success: false,
          message: "Valid invoice ID is required",
        });
      }

      // Validate tenant ID
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: "Tenant ID is required",
        });
      }

      const result = await InvoiceService.deleteInvoice(tenantId, invoiceId);

      return res.status(200).json({
        success: true,
        message: result.message,
        data: result.deletedInvoice,
      });
    } catch (error) {
      console.error("Delete invoice error:", error);

      if (error.message === "Invoice not found") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message === "Cannot delete a paid invoice") {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Failed to delete invoice",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  // GENERATE AND DOWNLOAD INVOICE
  // In invoice.controller.js
  // In invoice.controller.js - Update the downloadInvoice method

  async downloadInvoice(req, res) {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      const invoiceId = req.params.id;

      console.log("=== DOWNLOAD INVOICE CONTROLLER ===");
      console.log("Tenant ID:", tenantId);
      console.log("Invoice ID:", invoiceId);

      if (!invoiceId || isNaN(invoiceId)) {
        return res.status(400).json({
          success: false,
          message: "Valid invoice ID is required",
        });
      }

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: "Tenant ID is required",
        });
      }

      const pdfBuffer = await InvoiceService.generateInvoicePDF(
        tenantId,
        invoiceId,
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=invoice_${invoiceId}.pdf`,
      );

      return res.send(pdfBuffer);
    } catch (error) {
      console.error("Download invoice error:", error);

      if (error.message === "Invoice not found") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Failed to generate invoice PDF",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
}

module.exports = new InvoiceController();
