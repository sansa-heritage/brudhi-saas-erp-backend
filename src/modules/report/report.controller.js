const ReportService = require('./report.service');
const ResponseUtil = require('../../utils/response');
const logger = require('../../config/logger');
const moment = require('moment');

class ReportController {
  async getSalesReport(req, res) {
    try {
      const fromDate = req.query.fromDate || moment().startOf('month').format('YYYY-MM-DD');
      const toDate = req.query.toDate || moment().format('YYYY-MM-DD');
      
      const report = await ReportService.getSalesReport(req.tenantId, fromDate, toDate);
      return ResponseUtil.success(res, report, 'Sales report generated successfully');
    } catch (error) {
      logger.error('Get sales report error:', error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  async getStockReport(req, res) {
    try {
      const report = await ReportService.getStockReport(req.tenantId);
      return ResponseUtil.success(res, report, 'Stock report generated successfully');
    } catch (error) {
      logger.error('Get stock report error:', error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  async getFinancialReport(req, res) {
    try {
      const fromDate = req.query.fromDate || moment().startOf('month').format('YYYY-MM-DD');
      const toDate = req.query.toDate || moment().format('YYYY-MM-DD');
      
      const report = await ReportService.getFinancialReport(req.tenantId, fromDate, toDate);
      return ResponseUtil.success(res, report, 'Financial report generated successfully');
    } catch (error) {
      logger.error('Get financial report error:', error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  async getCustomerReport(req, res) {
    try {
      const fromDate = req.query.fromDate || moment().startOf('year').format('YYYY-MM-DD');
      const toDate = req.query.toDate || moment().format('YYYY-MM-DD');
      
      const report = await ReportService.getCustomerReport(
        req.tenantId,
        req.params.customerId,
        fromDate,
        toDate
      );
      return ResponseUtil.success(res, report, 'Customer report generated successfully');
    } catch (error) {
      logger.error('Get customer report error:', error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  async getDashboardSummary(req, res) {
    try {
      const summary = await ReportService.getDashboardSummary(req.tenantId);
      return ResponseUtil.success(res, summary, 'Dashboard summary fetched successfully');
    } catch (error) {
      logger.error('Get dashboard summary error:', error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }
}

module.exports = new ReportController();