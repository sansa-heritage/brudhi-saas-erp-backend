const ReportService = require("./report.service");
const moment = require("moment");
const DatabaseManager = require("../../services/database-manager.service");

class ReportController {
  async getSalesReport(req, res) {
    try {
      const fromDate =
        req.query.fromDate || moment().startOf("month").format("YYYY-MM-DD");
      const toDate = req.query.toDate || moment().format("YYYY-MM-DD");
      const format = req.query.format; // Get the format parameter

      console.log(
        `Sales report request - Format: ${format || "json"}, From: ${fromDate}, To: ${toDate}`,
      );

      // If format is specified, export instead of returning JSON
      if (format && ["pdf", "csv", "xlsx"].includes(format.toLowerCase())) {
        // Set the query parameters for the export function
        req.query.fromDate = fromDate;
        req.query.toDate = toDate;
        req.query.format = format.toLowerCase();

        // Call the export function
        return await this.exportSalesReport(req, res);
      }

      // Otherwise, return JSON data (existing functionality)
      const report = await ReportService.getSalesReport(
        req.tenantId,
        fromDate,
        toDate,
      );

      res.json({
        success: true,
        data: report,
        message: "Sales report generated successfully",
      });
    } catch (error) {
      console.error("Get sales report error:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching sales report",
        error: error.message,
      });
    }
  }

  async getStockReport(req, res) {
    try {
      const report = await ReportService.getStockReport(req.tenantId);
      res.json({
        success: true,
        data: report,
        message: "Stock report generated successfully",
      });
    } catch (error) {
      console.error("Get stock report error:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching stock report",
        error: error.message,
      });
    }
  }

  async getFinancialReport(req, res) {
    try {
      const fromDate =
        req.query.fromDate || moment().startOf("year").format("YYYY-MM-DD");
      const toDate = req.query.toDate || moment().format("YYYY-MM-DD");

      const report = await ReportService.getFinancialReport(
        req.tenantId,
        fromDate,
        toDate,
      );
      res.json({
        success: true,
        data: report,
        message: "Financial report generated successfully",
      });
    } catch (error) {
      console.error("Get financial report error:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching financial report",
        error: error.message,
      });
    }
  }

  async getCustomerReport(req, res) {
    try {
      if (!req.params.customerId) {
        return res.status(400).json({
          success: false,
          message: "Customer ID is required",
        });
      }

      const fromDate =
        req.query.fromDate || moment().startOf("year").format("YYYY-MM-DD");
      const toDate = req.query.toDate || moment().format("YYYY-MM-DD");

      const report = await ReportService.getCustomerReport(
        req.tenantId,
        req.params.customerId,
        fromDate,
        toDate,
      );
      return res.json({
        success: true,
        data: report,
        message: "Customer report generated successfully",
      });
    } catch (error) {
      console.error("Get customer report error:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching customer report",
        error: error.message,
      });
    }
  }

  async getDashboardSummary(req, res) {
    try {
      const summary = await ReportService.getDashboardSummary(req.tenantId);
      res.json({
        success: true,
        data: summary,
        message: "Dashboard summary fetched successfully",
      });
    } catch (error) {
      console.error("Get dashboard summary error:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching dashboard summary",
        error: error.message,
      });
    }
  }

  // Export Sales Report (FIXED - using Buffer approach)
  async exportSalesReport(req, res) {
    try {
      const fromDate =
        req.query.fromDate || moment().startOf("month").format("YYYY-MM-DD");
      const toDate = req.query.toDate || moment().format("YYYY-MM-DD");
      const format = req.query.format || "pdf";

      console.log(
        `Exporting sales report in ${format} format from ${fromDate} to ${toDate}`,
      );

      if (format === "pdf") {
        const pdfBuffer = await ReportService.exportSalesReportPDF(
          req.tenantId,
          fromDate,
          toDate,
        );

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=sales_report_${Date.now()}.pdf`,
        );
        res.setHeader("Content-Length", pdfBuffer.length);

        res.send(pdfBuffer);
      } else if (format === "csv") {
        const csv = await ReportService.exportSalesReportCSV(
          req.tenantId,
          fromDate,
          toDate,
        );

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=sales_report_${Date.now()}.csv`,
        );
        res.send(csv);
      } else if (format === "xlsx") {
        const workbook = await ReportService.exportSalesReportXLSX(
          req.tenantId,
          fromDate,
          toDate,
        );

        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=sales_report_${Date.now()}.xlsx`,
        );

        await workbook.xlsx.write(res);
        res.end();
      } else {
        res.status(400).json({
          success: false,
          message: "Invalid format. Supported formats: pdf, csv, xlsx",
        });
      }
    } catch (error) {
      console.error("Export sales report error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Error exporting sales report",
          error: error.message,
        });
      }
    }
  }

  // Export Expenses Report
  async exportExpensesReport(req, res) {
    try {
      const fromDate =
        req.query.fromDate || moment().startOf("month").format("YYYY-MM-DD");
      const toDate = req.query.toDate || moment().format("YYYY-MM-DD");
      const format = req.query.format || "pdf";

      if (format === "pdf") {
        const pdfBuffer = await ReportService.exportExpensesReportPDF(
          req.tenantId,
          fromDate,
          toDate,
        );

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=expenses_report_${Date.now()}.pdf`,
        );
        res.setHeader("Content-Length", pdfBuffer.length);

        res.send(pdfBuffer);
      } else {
        res.status(400).json({
          success: false,
          message: "Invalid format. Only PDF is supported",
        });
      }
    } catch (error) {
      console.error("Export expenses report error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Error exporting expenses report",
          error: error.message,
        });
      }
    }
  }

  // Export Financial Report
  async exportFinancialReport(req, res) {
    try {
      const fromDate =
        req.query.fromDate || moment().startOf("year").format("YYYY-MM-DD");
      const toDate = req.query.toDate || moment().format("YYYY-MM-DD");
      const format = req.query.format || "pdf";

      if (format === "pdf") {
        const pdfBuffer = await ReportService.exportFinancialReportPDF(
          req.tenantId,
          fromDate,
          toDate,
        );

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=financial_report_${Date.now()}.pdf`,
        );
        res.setHeader("Content-Length", pdfBuffer.length);

        res.send(pdfBuffer);
      } else {
        res.status(400).json({
          success: false,
          message: "Invalid format. Only PDF is supported",
        });
      }
    } catch (error) {
      console.error("Export financial report error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Error exporting financial report",
          error: error.message,
        });
      }
    }
  }

  // Export Customer Report
  async exportCustomerReport(req, res) {
    try {
      if (!req.params.customerId) {
        return res.status(400).json({
          success: false,
          message: "Customer ID is required",
        });
      }

      const fromDate =
        req.query.fromDate || moment().startOf("year").format("YYYY-MM-DD");
      const toDate = req.query.toDate || moment().format("YYYY-MM-DD");
      const format = req.query.format || "pdf";

      // First check if customer exists
      const customerCheck = await ReportService.getCustomerReport(
        req.tenantId,
        req.params.customerId,
        fromDate,
        toDate,
      );

      if (!customerCheck.customer) {
        return res.status(404).json({
          success: false,
          message: `Customer not found with ID: ${req.params.customerId}`,
        });
      }

      if (format === "pdf") {
        const pdfBuffer = await ReportService.exportCustomerReportPDF(
          req.tenantId,
          req.params.customerId,
          fromDate,
          toDate,
        );

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=customer_report_${customerCheck.customer.name || "customer"}_${Date.now()}.pdf`,
        );
        res.setHeader("Content-Length", pdfBuffer.length);

        res.send(pdfBuffer);
      } else if (format === "csv") {
        const csv = await ReportService.exportCustomerReportCSV(
          req.tenantId,
          req.params.customerId,
          fromDate,
          toDate,
        );

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=customer_report_${customerCheck.customer.name || "customer"}_${Date.now()}.csv`,
        );
        res.send(csv);
      } else {
        res.status(400).json({
          success: false,
          message: "Invalid format. Supported formats: pdf, csv",
        });
      }
    } catch (error) {
      console.error("Export customer report error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Error exporting customer report",
          error: error.message,
        });
      }
    }
  }
}

module.exports = new ReportController();
