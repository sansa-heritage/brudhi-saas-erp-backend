const DashboardService = require("./dashboard.service");
const ResponseUtil = require("../../utils/response");
const logger = require("../../config/logger");

class DashboardController {
  static async getStats(req, res) {
    try {
      const { tenantId } = req;
      const stats = await DashboardService.getStats(tenantId);
      res.json(stats);
    } catch (error) {
      console.error("Error in getStats:", error);
      res
        .status(500)
        .json({
          message: "Error fetching dashboard stats",
          error: error.message,
        });
    }
  }

  static async getCharts(req, res) {
    try {
      const { tenantId } = req;
      const charts = await DashboardService.getCharts(tenantId);
      res.json(charts);
    } catch (error) {
      console.error("Error in getCharts:", error);
      res
        .status(500)
        .json({ message: "Error fetching chart data", error: error.message });
    }
  }

  static async getSalesData(req, res) {
    try {
      const { tenantId } = req;
      const { period = "weekly" } = req.query;
      const salesData = await DashboardService.getSalesData(tenantId, period);
      res.json(salesData);
    } catch (error) {
      console.error("Error in getSalesData:", error);
      res
        .status(500)
        .json({ message: "Error fetching sales data", error: error.message });
    }
  }

  static async getRecentInvoices(req, res) {
    try {
      const { tenantId } = req;
      const invoices = await DashboardService.getRecentInvoices(tenantId);
      res.json(invoices);
    } catch (error) {
      console.error("Error in getRecentInvoices:", error);
      res
        .status(500)
        .json({
          message: "Error fetching recent invoices",
          error: error.message,
        });
    }
  }

  static async getCustomerOverview(req, res) {
    try {
      const { tenantId } = req;
      const customers = await DashboardService.getCustomerOverview(tenantId);
      res.json(customers);
    } catch (error) {
      console.error("Error in getCustomerOverview:", error);
      res
        .status(500)
        .json({
          message: "Error fetching customer overview",
          error: error.message,
        });
    }
  }

  static async getExpenseSummary(req, res) {
    try {
      const { tenantId } = req;
      const expenses = await DashboardService.getExpenseSummary(tenantId);
      res.json(expenses);
    } catch (error) {
      console.error("Error in getExpenseSummary:", error);
      res
        .status(500)
        .json({
          message: "Error fetching expense summary",
          error: error.message,
        });
    }
  }
}

module.exports = DashboardController;
