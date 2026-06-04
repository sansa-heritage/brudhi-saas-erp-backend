const ReportService = require("./report.service");
const moment = require("moment");
const DatabaseManager = require("../../services/database-manager.service");

class ReportController {
  async getSalesReport(req, res) {
    try {
      const fromDate = req.query.fromDate || moment().startOf("month").format("YYYY-MM-DD");
      const toDate = req.query.toDate || moment().format("YYYY-MM-DD");

      const report = await ReportService.getSalesReport(req.tenantId, fromDate, toDate);
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
      const fromDate = req.query.fromDate || moment().startOf("year").format("YYYY-MM-DD");
      const toDate = req.query.toDate || moment().format("YYYY-MM-DD");

      const report = await ReportService.getFinancialReport(req.tenantId, fromDate, toDate);
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

      const fromDate = req.query.fromDate || moment().startOf("year").format("YYYY-MM-DD");
      const toDate = req.query.toDate || moment().format("YYYY-MM-DD");

      const report = await ReportService.getCustomerReport(
        req.tenantId,
        req.params.customerId,
        fromDate,
        toDate
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

  // Export Sales Report
  async exportSalesReport(req, res) {
    try {
      const fromDate = req.query.fromDate || moment().startOf("month").format("YYYY-MM-DD");
      const toDate = req.query.toDate || moment().format("YYYY-MM-DD");
      const format = req.query.format || "pdf";

      if (format === "pdf") {
        const doc = await ReportService.exportSalesReportPDF(req.tenantId, fromDate, toDate);
        
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=sales_report_${Date.now()}.pdf`);
        
        doc.pipe(res);
        doc.end();
      } else {
        res.status(400).json({
          success: false,
          message: "Invalid format. Only PDF is supported",
        });
      }
    } catch (error) {
      console.error("Export sales report error:", error);
      res.status(500).json({
        success: false,
        message: "Error exporting sales report",
        error: error.message,
      });
    }
  }

  // Export Expenses Report
  async exportExpensesReport(req, res) {
    try {
      const fromDate = req.query.fromDate || moment().startOf("month").format("YYYY-MM-DD");
      const toDate = req.query.toDate || moment().format("YYYY-MM-DD");
      const format = req.query.format || "pdf";

      if (format === "pdf") {
        const doc = await ReportService.exportExpensesReportPDF(req.tenantId, fromDate, toDate);
        
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=expenses_report_${Date.now()}.pdf`);
        
        doc.pipe(res);
        doc.end();
      } else {
        res.status(400).json({
          success: false,
          message: "Invalid format. Only PDF is supported",
        });
      }
    } catch (error) {
      console.error("Export expenses report error:", error);
      res.status(500).json({
        success: false,
        message: "Error exporting expenses report",
        error: error.message,
      });
    }
  }

  // Export Financial Report
  async exportFinancialReport(req, res) {
    try {
      const fromDate = req.query.fromDate || moment().startOf("year").format("YYYY-MM-DD");
      const toDate = req.query.toDate || moment().format("YYYY-MM-DD");
      const format = req.query.format || "pdf";

      if (format === "pdf") {
        const doc = await ReportService.exportFinancialReportPDF(req.tenantId, fromDate, toDate);
        
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=financial_report_${Date.now()}.pdf`);
        
        doc.pipe(res);
        doc.end();
      } else {
        res.status(400).json({
          success: false,
          message: "Invalid format. Only PDF is supported",
        });
      }
    } catch (error) {
      console.error("Export financial report error:", error);
      res.status(500).json({
        success: false,
        message: "Error exporting financial report",
        error: error.message,
      });
    }
  }

  // Export Customer Report
  async exportCustomerReport(req, res) {
    try {
      console.log("=== Export Customer Report Called ===");
      
      if (!req.params.customerId) {
        return res.status(400).json({
          success: false,
          message: "Customer ID is required",
        });
      }

      const fromDate = req.query.fromDate || moment().startOf("year").format("YYYY-MM-DD");
      const toDate = req.query.toDate || moment().format("YYYY-MM-DD");
      const format = req.query.format || "pdf";

      // First check if customer exists
      const customerData = await ReportService.getCustomerReport(
        req.tenantId,
        req.params.customerId,
        fromDate,
        toDate
      );

      if (!customerData.customer || Object.keys(customerData.customer).length === 0) {
        return res.status(404).json({
          success: false,
          message: "Customer not found",
        });
      }

      const customer = customerData.customer;

      if (format === "pdf") {
        const doc = await ReportService.exportCustomerReportPDF(
          req.tenantId,
          req.params.customerId,
          fromDate,
          toDate
        );

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=customer_report_${customer.name || "customer"}_${Date.now()}.pdf`
        );

        doc.pipe(res);
        doc.end();
      } else if (format === "csv") {
        let csv = "Customer Report\n\n";
        csv += `Customer Name,${customer.name || "N/A"}\n`;
        csv += `Email,${customer.email || "N/A"}\n`;
        csv += `Mobile,${customer.mobile || "N/A"}\n`;
        csv += `Address,${customer.address || "N/A"}\n`;
        csv += `GST Number,${customer.gst_number || "N/A"}\n`;
        csv += `Period,${fromDate} to ${toDate}\n\n`;

        csv += `Summary\n`;
        csv += `Total Invoices,${customerData.summary.total_invoices}\n`;
        csv += `Total Purchases,${customerData.summary.total_purchases}\n`;
        csv += `Total GST,${customerData.summary.total_gst}\n`;
        csv += `Outstanding Amount,${customerData.summary.outstanding_amount}\n\n`;

        csv += `Invoice Details\n`;
        csv += `Invoice No,Date,Amount,GST,Status,Balance\n`;

        customerData.invoices.forEach((inv) => {
          csv += `${inv.invoice_no},`;
          csv += `${new Date(inv.invoice_date).toLocaleDateString("en-IN")},`;
          csv += `${inv.total_amount},`;
          csv += `${inv.gst_amount},`;
          csv += `${inv.payment_status},`;
          csv += `${inv.balance_amount}\n`;
        });

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=customer_report_${customer.name || "customer"}_${Date.now()}.csv`
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