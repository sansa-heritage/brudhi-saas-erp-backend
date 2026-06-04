// // // const InvoiceService = require("./invoice.service");
// // // const ResponseUtil = require("../../utils/response");
// // // const logger = require("../../config/logger");

// // // class InvoiceController {
// // //   async getAllInvoices(req, res) {
// // //     try {
// // //       const filters = {
// // //         partyType: req.query.partyType,
// // //         paymentStatus: req.query.paymentStatus,
// // //         fromDate: req.query.fromDate,
// // //         toDate: req.query.toDate,
// // //         page: req.query.page,
// // //         limit: req.query.limit,
// // //       };

// // //       const result = await InvoiceService.getAllInvoices(req.tenantId, filters);
// // //       return ResponseUtil.success(res, result, "Invoices fetched successfully");
// // //     } catch (error) {
// // //       logger.error("Get all invoices error:", error);
// // //       return ResponseUtil.error(res, error.message, 500);
// // //     }
// // //   }

// // //   // ✅ FIXED: Get invoice by ID - returns single object
// // //   async getInvoiceById(req, res) {
// // //     try {
// // //       const id = Number(req.params.id);

// // //       if (!id || isNaN(id)) {
// // //         return ResponseUtil.error(res, "Invalid invoice ID", 400);
// // //       }

// // //       const invoice = await InvoiceService.getInvoiceById(req.tenantId, id);

// // //       if (!invoice) {
// // //         return ResponseUtil.notFound(res, "Invoice not found");
// // //       }

// // //       return ResponseUtil.success(res, invoice, "Invoice fetched successfully");
// // //     } catch (error) {
// // //       logger.error("Get invoice by id error:", error);
// // //       return ResponseUtil.error(res, error.message, 500);
// // //     }
// // //   }

// // //   async createInvoice(req, res) {
// // //     try {
// // //       const tenantId = Number(req.tenantId);

// // //       if (!tenantId || isNaN(tenantId)) {
// // //         return ResponseUtil.error(res, "Invalid tenant ID", 400);
// // //       }

// // //       const invoiceData = {
// // //         partyType: req.body.partyType,
// // //         partyId: req.body.partyId,
// // //         partyName: req.body.partyName,
// // //         partyGst: req.body.partyGst,
// // //         partyAddress: req.body.partyAddress,
// // //         invoiceDate: req.body.invoiceDate,
// // //         dueDate: req.body.dueDate,
// // //         discountType: req.body.discountType,
// // //         discountValue: req.body.discountValue,
// // //         discountAmount: req.body.discountAmount,
// // //         roundOff: req.body.roundOff,
// // //         paymentStatus: req.body.paymentStatus,
// // //         paidAmount: req.body.paidAmount,
// // //         paymentMethod: req.body.paymentMethod,
// // //         transactionId: req.body.transactionId,
// // //         notes: req.body.notes,
// // //         termsConditions: req.body.termsConditions,
// // //         createdBy: req.user?.id || req.body.createdBy,
// // //       };

// // //       const items = req.body.items;

// // //       if (!invoiceData.partyType) {
// // //         return ResponseUtil.error(res, "partyType is required", 400);
// // //       }
// // //       if (!invoiceData.partyId) {
// // //         return ResponseUtil.error(res, "partyId is required", 400);
// // //       }
// // //       if (!invoiceData.partyName) {
// // //         return ResponseUtil.error(res, "partyName is required", 400);
// // //       }
// // //       if (!items || !Array.isArray(items) || items.length === 0) {
// // //         return ResponseUtil.error(res, "items array is required", 400);
// // //       }

// // //       const invoiceId = await InvoiceService.createInvoice(
// // //         tenantId,
// // //         invoiceData,
// // //         items,
// // //       );

// // //       const invoice = await InvoiceService.getInvoiceById(tenantId, invoiceId);

// // //       return ResponseUtil.created(res, invoice, "Invoice created successfully");
// // //     } catch (error) {
// // //       logger.error("Create invoice error:", error);
// // //       return ResponseUtil.error(res, error.message, 400);
// // //     }
// // //   }

// // //   async recordPayment(req, res) {
// // //     try {
// // //       const paymentData = { ...req.body, receivedBy: req.user.id };
// // //       await InvoiceService.recordPayment(req.tenantId, paymentData);
// // //       const invoice = await InvoiceService.getInvoiceById(
// // //         req.tenantId,
// // //         paymentData.invoiceId,
// // //       );
// // //       return ResponseUtil.success(
// // //         res,
// // //         invoice,
// // //         "Payment recorded successfully",
// // //       );
// // //     } catch (error) {
// // //       logger.error("Record payment error:", error);
// // //       return ResponseUtil.error(res, error.message, 400);
// // //     }
// // //   }

// // //   // ✅ FIXED: Update invoice
// // //   async updateInvoice(req, res) {
// // //     try {
// // //       const id = Number(req.params.id);

// // //       if (!id || isNaN(id)) {
// // //         return ResponseUtil.error(res, "Invalid invoice ID", 400);
// // //       }

// // //       const existingInvoice = await InvoiceService.getInvoiceById(
// // //         req.tenantId,
// // //         id,
// // //       );

// // //       if (!existingInvoice) {
// // //         return ResponseUtil.notFound(res, "Invoice not found");
// // //       }

// // //       await InvoiceService.updateInvoice(req.tenantId, id, req.body);
// // //       const invoice = await InvoiceService.getInvoiceById(req.tenantId, id);

// // //       return ResponseUtil.success(res, invoice, "Invoice updated successfully");
// // //     } catch (error) {
// // //       logger.error("Update invoice error:", error);
// // //       return ResponseUtil.error(res, error.message, 400);
// // //     }
// // //   }

// // //   // Delete invoice (hard delete)
// // //   // In invoice.controller.js
// // //   async deleteInvoice(req, res) {
// // //     try {
// // //       const tenantId = req.tenantId || req.user?.tenantId;
// // //       const invoiceId = req.params.id;

// // //       console.log("=== DELETE INVOICE CONTROLLER ===");
// // //       console.log("Tenant ID:", tenantId);
// // //       console.log("Invoice ID:", invoiceId);

// // //       // Validate invoice ID
// // //       if (!invoiceId || isNaN(invoiceId)) {
// // //         return res.status(400).json({
// // //           success: false,
// // //           message: "Valid invoice ID is required",
// // //         });
// // //       }

// // //       // Validate tenant ID
// // //       if (!tenantId) {
// // //         return res.status(400).json({
// // //           success: false,
// // //           message: "Tenant ID is required",
// // //         });
// // //       }

// // //       const result = await InvoiceService.deleteInvoice(tenantId, invoiceId);

// // //       return res.status(200).json({
// // //         success: true,
// // //         message: result.message,
// // //         data: result.deletedInvoice,
// // //       });
// // //     } catch (error) {
// // //       console.error("Delete invoice error:", error);

// // //       if (error.message === "Invoice not found") {
// // //         return res.status(404).json({
// // //           success: false,
// // //           message: error.message,
// // //         });
// // //       }

// // //       if (error.message === "Cannot delete a paid invoice") {
// // //         return res.status(400).json({
// // //           success: false,
// // //           message: error.message,
// // //         });
// // //       }

// // //       return res.status(500).json({
// // //         success: false,
// // //         message: "Failed to delete invoice",
// // //         error:
// // //           process.env.NODE_ENV === "development" ? error.message : undefined,
// // //       });
// // //     }
// // //   }

// // //   // GENERATE AND DOWNLOAD INVOICE
// // //   // In invoice.controller.js
// // //   // In invoice.controller.js - Update the downloadInvoice method

// // //   async downloadInvoice(req, res) {
// // //     try {
// // //       const tenantId = req.tenantId || req.user?.tenantId;
// // //       const invoiceId = req.params.id;

// // //       console.log("=== DOWNLOAD INVOICE CONTROLLER ===");
// // //       console.log("Tenant ID:", tenantId);
// // //       console.log("Invoice ID:", invoiceId);

// // //       if (!invoiceId || isNaN(invoiceId)) {
// // //         return res.status(400).json({
// // //           success: false,
// // //           message: "Valid invoice ID is required",
// // //         });
// // //       }

// // //       if (!tenantId) {
// // //         return res.status(400).json({
// // //           success: false,
// // //           message: "Tenant ID is required",
// // //         });
// // //       }

// // //       const pdfBuffer = await InvoiceService.generateInvoicePDF(
// // //         tenantId,
// // //         invoiceId,
// // //       );

// // //       res.setHeader("Content-Type", "application/pdf");
// // //       res.setHeader(
// // //         "Content-Disposition",
// // //         `attachment; filename=invoice_${invoiceId}.pdf`,
// // //       );

// // //       return res.send(pdfBuffer);
// // //     } catch (error) {
// // //       console.error("Download invoice error:", error);

// // //       if (error.message === "Invoice not found") {
// // //         return res.status(404).json({
// // //           success: false,
// // //           message: error.message,
// // //         });
// // //       }

// // //       return res.status(500).json({
// // //         success: false,
// // //         message: "Failed to generate invoice PDF",
// // //         error:
// // //           process.env.NODE_ENV === "development" ? error.message : undefined,
// // //       });
// // //     }
// // //   }
// // // }

// // // module.exports = new InvoiceController();

// // const InvoiceService = require("./invoice.service");
// // const ResponseUtil = require("../../utils/response");
// // const logger = require("../../config/logger");

// // class InvoiceController {
// //   // ==============================================
// //   // INVOICE CRUD OPERATIONS
// //   // ==============================================

// //   /**
// //    * Get all invoices with pagination and filters
// //    */
// //   async getAllInvoices(req, res) {
// //     try {
// //       const filters = {
// //         partyType: req.query.partyType,
// //         paymentStatus: req.query.paymentStatus,
// //         fromDate: req.query.fromDate,
// //         toDate: req.query.toDate,
// //         page: req.query.page,
// //         limit: req.query.limit,
// //       };

// //       const result = await InvoiceService.getAllInvoices(req.tenantId, filters);

// //       return ResponseUtil.success(res, result, "Invoices fetched successfully");
// //     } catch (error) {
// //       logger.error("Get invoices error:", error);
// //       return ResponseUtil.error(res, error.message, 500);
// //     }
// //   }

// //   /**
// //    * Get single invoice by ID
// //    */
// //   async getInvoiceById(req, res) {
// //     try {
// //       const invoice = await InvoiceService.getInvoiceById(
// //         req.tenantId,
// //         req.params.id,
// //       );

// //       if (!invoice) {
// //         return ResponseUtil.notFound(res, "Invoice not found");
// //       }

// //       return ResponseUtil.success(res, invoice, "Invoice fetched successfully");
// //     } catch (error) {
// //       logger.error("Get invoice error:", error);
// //       return ResponseUtil.error(res, error.message, 500);
// //     }
// //   }

// //   /**
// //    * Create new invoice
// //    */
// //   async createInvoice(req, res) {
// //     try {
// //       const invoiceId = await InvoiceService.createInvoice(
// //         req.tenantId,
// //         req.body,
// //         req.body.items,
// //       );

// //       const invoice = await InvoiceService.getInvoiceById(
// //         req.tenantId,
// //         invoiceId,
// //       );

// //       return ResponseUtil.created(res, invoice, "Invoice created successfully");
// //     } catch (error) {
// //       logger.error("Create invoice error:", error);
// //       return ResponseUtil.error(res, error.message, 400);
// //     }
// //   }

// //   /**
// //    * Update existing invoice
// //    */
// //   async updateInvoice(req, res) {
// //     try {
// //       const { id } = req.params;

// //       if (!id || isNaN(id)) {
// //         return ResponseUtil.error(res, "Invalid invoice ID", 400);
// //       }

// //       await InvoiceService.updateInvoice(req.tenantId, id, req.body);

// //       const invoice = await InvoiceService.getInvoiceById(req.tenantId, id);

// //       return ResponseUtil.success(res, invoice, "Invoice updated successfully");
// //     } catch (error) {
// //       logger.error("Update invoice error:", error);
// //       return ResponseUtil.error(res, error.message, 400);
// //     }
// //   }

// //   /**
// //    * Delete invoice
// //    */
// //   async deleteInvoice(req, res) {
// //     try {
// //       const result = await InvoiceService.deleteInvoice(
// //         req.tenantId,
// //         req.params.id,
// //       );

// //       return ResponseUtil.success(res, result, "Invoice deleted successfully");
// //     } catch (error) {
// //       logger.error("Delete invoice error:", error);
// //       return ResponseUtil.error(res, error.message, 500);
// //     }
// //   }

// //   // ==============================================
// //   // PAYMENT OPERATIONS
// //   // ==============================================

// //   /**
// //    * Record payment for an invoice
// //    */
// //   async recordPayment(req, res) {
// //     try {
// //       const paymentData = {
// //         ...req.body,
// //         invoiceId: req.params.id,
// //         receivedBy: req.user?.id,
// //       };

// //       await InvoiceService.recordPayment(req.tenantId, paymentData);

// //       return ResponseUtil.success(res, null, "Payment recorded successfully");
// //     } catch (error) {
// //       logger.error("Payment error:", error);
// //       return ResponseUtil.error(res, error.message, 400);
// //     }
// //   }

// //   // ==============================================
// //   // INVOICE GENERATION & DOWNLOAD
// //   // ==============================================

// //   /**
// //    * Download invoice in various formats (PDF, Excel, CSV, JSON)
// //    */
// //   async downloadInvoice(req, res) {
// //     try {
// //       const { tenantId, params, query } = req;
// //       const format = query.format || "pdf";

// //       const fileBuffer = await InvoiceService.generateInvoice(
// //         tenantId,
// //         params.id,
// //         format,
// //       );

// //       const contentType = this._getContentType(format);
// //       const filename = `invoice_${params.id}.${format}`;

// //       res.setHeader("Content-Type", contentType);
// //       res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

// //       return res.send(fileBuffer);
// //     } catch (error) {
// //       logger.error("Download invoice error:", error);
// //       return ResponseUtil.error(res, error.message, 500);
// //     }
// //   }

// //   /**
// //    * Generate and return invoice (for preview)
// //    */
// //   async generateInvoice(req, res) {
// //     try {
// //       const { tenantId, params, query } = req;
// //       const format = query.format || "pdf";

// //       const fileBuffer = await InvoiceService.generateInvoice(
// //         tenantId,
// //         params.id,
// //         format,
// //       );

// //       // For PDF, display inline; for others, download as attachment
// //       const contentType = this._getContentType(format);
// //       const disposition = format === "pdf" ? "inline" : "attachment";
// //       const filename = `invoice_${params.id}.${format}`;

// //       res.setHeader("Content-Type", contentType);
// //       res.setHeader(
// //         "Content-Disposition",
// //         `${disposition}; filename=${filename}`,
// //       );

// //       return res.send(fileBuffer);
// //     } catch (error) {
// //       logger.error("Generate invoice error:", error);
// //       return ResponseUtil.error(res, error.message, 500);
// //     }
// //   }

// //   // ==============================================
// //   // PRIVATE HELPER METHODS
// //   // ==============================================

// //   /**
// //    * Get content type based on file format
// //    */
// //   _getContentType(format) {
// //     const contentTypes = {
// //       pdf: "application/pdf",
// //       excel:
// //         "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
// //       csv: "text/csv",
// //       json: "application/json",
// //     };

// //     return contentTypes[format.toLowerCase()] || "application/octet-stream";
// //   }
// // }

// // module.exports = new InvoiceController();

// // src/modules/invoice/invoice.controller.js

// const InvoiceService = require("./invoice.service");
// const ResponseUtil = require("../../utils/response");
// const logger = require("../../config/logger");

// class InvoiceController {
//   // ==============================================
//   // INVOICE CRUD OPERATIONS
//   // ==============================================

//   /**
//    * Get all invoices with pagination and filters
//    */
//   async getAllInvoices(req, res) {
//     try {
//       const filters = {
//         partyType: req.query.partyType,
//         paymentStatus: req.query.paymentStatus,
//         fromDate: req.query.fromDate,
//         toDate: req.query.toDate,
//         page: req.query.page,
//         limit: req.query.limit,
//       };

//       const result = await InvoiceService.getAllInvoices(req.tenantId, filters);
//       return ResponseUtil.success(res, result, "Invoices fetched successfully");
//     } catch (error) {
//       logger.error("Get invoices error:", error);
//       return ResponseUtil.error(res, error.message, 500);
//     }
//   }

//   /**
//    * Get single invoice by ID
//    */
//   async getInvoiceById(req, res) {
//     try {
//       const { id } = req.params;

//       if (!id || isNaN(id)) {
//         return ResponseUtil.error(res, "Invalid invoice ID", 400);
//       }

//       const invoice = await InvoiceService.getInvoiceById(req.tenantId, id);

//       if (!invoice) {
//         return ResponseUtil.notFound(res, "Invoice not found");
//       }

//       return ResponseUtil.success(res, invoice, "Invoice fetched successfully");
//     } catch (error) {
//       logger.error("Get invoice error:", error);
//       return ResponseUtil.error(res, error.message, 500);
//     }
//   }

//   /**
//    * Create new invoice
//    */
//   async createInvoice(req, res) {
//     try {
//       const invoiceId = await InvoiceService.createInvoice(
//         req.tenantId,
//         req.body,
//         req.body.items,
//       );

//       const invoice = await InvoiceService.getInvoiceById(
//         req.tenantId,
//         invoiceId,
//       );

//       return ResponseUtil.created(res, invoice, "Invoice created successfully");
//     } catch (error) {
//       logger.error("Create invoice error:", error);
//       return ResponseUtil.error(res, error.message, 400);
//     }
//   }

//   /**
//    * Update existing invoice
//    */
//   async updateInvoice(req, res) {
//     try {
//       const { id } = req.params;

//       if (!id || isNaN(id)) {
//         return ResponseUtil.error(res, "Invalid invoice ID", 400);
//       }

//       await InvoiceService.updateInvoice(req.tenantId, id, req.body);
//       const invoice = await InvoiceService.getInvoiceById(req.tenantId, id);

//       return ResponseUtil.success(res, invoice, "Invoice updated successfully");
//     } catch (error) {
//       logger.error("Update invoice error:", error);
//       return ResponseUtil.error(res, error.message, 400);
//     }
//   }

//   /**
//    * Delete invoice
//    */
//   async deleteInvoice(req, res) {
//     try {
//       const { id } = req.params;

//       if (!id || isNaN(id)) {
//         return ResponseUtil.error(res, "Invalid invoice ID", 400);
//       }

//       const result = await InvoiceService.deleteInvoice(req.tenantId, id);

//       return ResponseUtil.success(res, result, "Invoice deleted successfully");
//     } catch (error) {
//       logger.error("Delete invoice error:", error);
//       return ResponseUtil.error(res, error.message, 500);
//     }
//   }

//   // ==============================================
//   // PAYMENT OPERATIONS
//   // ==============================================

//   /**
//    * Record payment for an invoice
//    */
//   async recordPayment(req, res) {
//     try {
//       const { id } = req.params;

//       if (!id || isNaN(id)) {
//         return ResponseUtil.error(res, "Invalid invoice ID", 400);
//       }

//       const paymentData = {
//         invoiceId: id,
//         ...req.body,
//         receivedBy: req.user?.id,
//       };

//       await InvoiceService.recordPayment(req.tenantId, paymentData);

//       return ResponseUtil.success(res, null, "Payment recorded successfully");
//     } catch (error) {
//       logger.error("Payment error:", error);
//       return ResponseUtil.error(res, error.message, 400);
//     }
//   }

//   /**
//    * Update invoice payment status
//    */
//   async updateInvoiceStatus(req, res) {
//     try {
//       const { id } = req.params;
//       const { status } = req.body;

//       if (!id || isNaN(id)) {
//         return ResponseUtil.error(res, "Invalid invoice ID", 400);
//       }

//       const validStatuses = ["paid", "unpaid", "partial", "cancelled"];
//       if (!validStatuses.includes(status)) {
//         return ResponseUtil.error(res, "Invalid payment status", 400);
//       }

//       await InvoiceService.updateInvoiceStatus(req.tenantId, id, status);

//       return ResponseUtil.success(
//         res,
//         null,
//         "Invoice status updated successfully",
//       );
//     } catch (error) {
//       logger.error("Update invoice status error:", error);
//       return ResponseUtil.error(res, error.message, 400);
//     }
//   }

//   // ==============================================
//   // INVOICE GENERATION & DOWNLOAD
//   // ==============================================

//   async downloadInvoice(req, res) {
//     try {
//       const { id } = req.params;
//       const { format = "pdf" } = req.query;

//       if (!id || isNaN(id)) {
//         return ResponseUtil.error(res, "Invalid invoice ID", 400);
//       }

//       const fileBuffer = await InvoiceService.generateInvoice(
//         req.tenantId,
//         id,
//         format,
//       );

//       // ✅ Define content types inline instead of calling _getContentType
//       const contentTypes = {
//         pdf: "application/pdf",
//         excel:
//           "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//         csv: "text/csv",
//         json: "application/json",
//       };

//       const contentType =
//         contentTypes[format.toLowerCase()] || "application/octet-stream";
//       const filename = `invoice_${id}.${format}`;

//       res.setHeader("Content-Type", contentType);
//       res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

//       return res.send(fileBuffer);
//     } catch (error) {
//       logger.error("Download invoice error:", error);
//       return ResponseUtil.error(res, error.message, 500);
//     }
//   }

//   async generateInvoice(req, res) {
//     try {
//       const { id } = req.params;
//       const { format = "pdf" } = req.query;

//       if (!id || isNaN(id)) {
//         return ResponseUtil.error(res, "Invalid invoice ID", 400);
//       }

//       const fileBuffer = await InvoiceService.generateInvoice(
//         req.tenantId,
//         id,
//         format,
//       );

//       // ✅ Define content types inline instead of calling _getContentType
//       const contentTypes = {
//         pdf: "application/pdf",
//         excel:
//           "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//         csv: "text/csv",
//         json: "application/json",
//       };

//       const contentType =
//         contentTypes[format.toLowerCase()] || "application/octet-stream";
//       const disposition = format === "pdf" ? "inline" : "attachment";
//       const filename = `invoice_${id}.${format}`;

//       res.setHeader("Content-Type", contentType);
//       res.setHeader(
//         "Content-Disposition",
//         `${disposition}; filename=${filename}`,
//       );

//       return res.send(fileBuffer);
//     } catch (error) {
//       logger.error("Generate invoice error:", error);
//       return ResponseUtil.error(res, error.message, 500);
//     }
//   }

//   /**
//    * Get invoice by number
//    */
//   async getInvoiceByNumber(req, res) {
//     try {
//       const { invoiceNo } = req.params;

//       if (!invoiceNo) {
//         return ResponseUtil.error(res, "Invoice number is required", 400);
//       }

//       const invoice = await InvoiceService.getInvoiceByNumber(
//         req.tenantId,
//         invoiceNo,
//       );

//       if (!invoice) {
//         return ResponseUtil.notFound(res, "Invoice not found");
//       }

//       return ResponseUtil.success(res, invoice, "Invoice fetched successfully");
//     } catch (error) {
//       logger.error("Get invoice by number error:", error);
//       return ResponseUtil.error(res, error.message, 500);
//     }
//   }

//   /**
//    * Get invoice summary for a party
//    */
//   async getInvoiceSummary(req, res) {
//     try {
//       const { partyType, partyId } = req.query;

//       if (!partyType || !partyId) {
//         return ResponseUtil.error(res, "Party type and ID are required", 400);
//       }

//       const summary = await InvoiceService.getInvoiceSummary(
//         req.tenantId,
//         partyType,
//         partyId,
//       );

//       return ResponseUtil.success(
//         res,
//         summary,
//         "Invoice summary fetched successfully",
//       );
//     } catch (error) {
//       logger.error("Get invoice summary error:", error);
//       return ResponseUtil.error(res, error.message, 500);
//     }
//   }

//   // ==============================================
//   // PRIVATE HELPER METHODS
//   // ==============================================

//   /**
//    * Get content type based on file format
//    */
//   _getContentType(format) {
//     const contentTypes = {
//       pdf: "application/pdf",
//       excel:
//         "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//       csv: "text/csv",
//       json: "application/json",
//     };

//     return contentTypes[format.toLowerCase()] || "application/octet-stream";
//   }
// }

// module.exports = new InvoiceController();


// src/modules/invoice/invoice.controller.js

const InvoiceService = require("./invoice.service");
const ResponseUtil = require("../../utils/response");
const logger = require("../../config/logger");

class InvoiceController {
  // ==============================================
  // INVOICE CRUD OPERATIONS
  // ==============================================

  /**
   * Get all invoices with pagination and filters
   */
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
      logger.error("Get invoices error:", error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  /**
   * Get single invoice by ID
   */
  async getInvoiceById(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return ResponseUtil.error(res, "Invalid invoice ID", 400);
      }

      const invoice = await InvoiceService.getInvoiceById(req.tenantId, id);

      if (!invoice) {
        return ResponseUtil.notFound(res, "Invoice not found");
      }

      return ResponseUtil.success(res, invoice, "Invoice fetched successfully");
    } catch (error) {
      logger.error("Get invoice error:", error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  /**
   * Create new invoice
   */
  async createInvoice(req, res) {
    try {
      const invoiceId = await InvoiceService.createInvoice(
        req.tenantId,
        req.body,
        req.body.items,
      );

      const invoice = await InvoiceService.getInvoiceById(
        req.tenantId,
        invoiceId,
      );

      return ResponseUtil.created(res, invoice, "Invoice created successfully");
    } catch (error) {
      logger.error("Create invoice error:", error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  /**
   * Update existing invoice
   */
  async updateInvoice(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return ResponseUtil.error(res, "Invalid invoice ID", 400);
      }

      await InvoiceService.updateInvoice(req.tenantId, id, req.body);
      const invoice = await InvoiceService.getInvoiceById(req.tenantId, id);

      return ResponseUtil.success(res, invoice, "Invoice updated successfully");
    } catch (error) {
      logger.error("Update invoice error:", error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  /**
   * Delete invoice
   */
  async deleteInvoice(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return ResponseUtil.error(res, "Invalid invoice ID", 400);
      }

      const result = await InvoiceService.deleteInvoice(req.tenantId, id);

      return ResponseUtil.success(res, result, "Invoice deleted successfully");
    } catch (error) {
      logger.error("Delete invoice error:", error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  // ==============================================
  // PAYMENT OPERATIONS
  // ==============================================

  /**
   * Record payment for an invoice
   */
  async recordPayment(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return ResponseUtil.error(res, "Invalid invoice ID", 400);
      }

      const paymentData = {
        invoiceId: id,
        ...req.body,
        receivedBy: req.user?.id,
      };

      await InvoiceService.recordPayment(req.tenantId, paymentData);

      return ResponseUtil.success(res, null, "Payment recorded successfully");
    } catch (error) {
      logger.error("Payment error:", error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  /**
   * Update invoice payment status
   */
  async updateInvoiceStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!id || isNaN(id)) {
        return ResponseUtil.error(res, "Invalid invoice ID", 400);
      }

      const validStatuses = ["paid", "unpaid", "partial", "cancelled"];
      if (!validStatuses.includes(status)) {
        return ResponseUtil.error(res, "Invalid payment status", 400);
      }

      await InvoiceService.updateInvoiceStatus(req.tenantId, id, status);

      return ResponseUtil.success(
        res,
        null,
        "Invoice status updated successfully",
      );
    } catch (error) {
      logger.error("Update invoice status error:", error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  // ==============================================
  // INVOICE GENERATION & DOWNLOAD
  // ==============================================

  /**
   * Download invoice in various formats (PDF, Excel, CSV, JSON)
   * This forces download as attachment
   */
  async downloadInvoice(req, res) {
    try {
      const { id } = req.params;
      const { format = "pdf" } = req.query;

      if (!id || isNaN(id)) {
        return ResponseUtil.error(res, "Invalid invoice ID", 400);
      }

      const fileBuffer = await InvoiceService.generateInvoice(
        req.tenantId,
        id,
        format,
      );

      const contentTypes = {
        pdf: "application/pdf",
        excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        csv: "text/csv",
        json: "application/json",
      };

      const contentType = contentTypes[format.toLowerCase()] || "application/octet-stream";
      const filename = `invoice_${id}.${format}`;

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      return res.send(fileBuffer);
    } catch (error) {
      logger.error("Download invoice error:", error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  /**
   * Generate and preview invoice (opens in browser for PDF)
   */
  async generateInvoice(req, res) {
    try {
      const { id } = req.params;
      const { format = "pdf" } = req.query;

      if (!id || isNaN(id)) {
        return ResponseUtil.error(res, "Invalid invoice ID", 400);
      }

      const fileBuffer = await InvoiceService.generateInvoice(
        req.tenantId,
        id,
        format,
      );

      const contentTypes = {
        pdf: "application/pdf",
        excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        csv: "text/csv",
        json: "application/json",
      };

      const contentType = contentTypes[format.toLowerCase()] || "application/octet-stream";
      // For PDF, display inline; for others, download as attachment
      const disposition = format === "pdf" ? "inline" : "attachment";
      const filename = `invoice_${id}.${format}`;

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);

      return res.send(fileBuffer);
    } catch (error) {
      logger.error("Generate invoice error:", error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  // ==============================================
  // UTILITY ENDPOINTS
  // ==============================================

  /**
   * Get invoice by number
   */
  async getInvoiceByNumber(req, res) {
    try {
      const { invoiceNo } = req.params;

      if (!invoiceNo) {
        return ResponseUtil.error(res, "Invoice number is required", 400);
      }

      const invoice = await InvoiceService.getInvoiceByNumber(
        req.tenantId,
        invoiceNo,
      );

      if (!invoice) {
        return ResponseUtil.notFound(res, "Invoice not found");
      }

      return ResponseUtil.success(res, invoice, "Invoice fetched successfully");
    } catch (error) {
      logger.error("Get invoice by number error:", error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  /**
   * Get invoice summary for a party
   */
  async getInvoiceSummary(req, res) {
    try {
      const { partyType, partyId } = req.query;

      if (!partyType || !partyId) {
        return ResponseUtil.error(res, "Party type and ID are required", 400);
      }

      const summary = await InvoiceService.getInvoiceSummary(
        req.tenantId,
        partyType,
        partyId,
      );

      return ResponseUtil.success(
        res,
        summary,
        "Invoice summary fetched successfully",
      );
    } catch (error) {
      logger.error("Get invoice summary error:", error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }
}

module.exports = new InvoiceController();
