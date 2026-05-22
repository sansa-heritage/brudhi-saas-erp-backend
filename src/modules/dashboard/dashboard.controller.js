const DashboardService = require('./dashboard.service');
const ResponseUtil = require('../../utils/response');
const logger = require('../../config/logger');

class DashboardController {
  async getStats(req, res) {
    try {
      const stats = await DashboardService.getStats(req.tenantId);
      return ResponseUtil.success(res, stats, 'Dashboard stats fetched successfully');
    } catch (error) {
      logger.error('Get dashboard stats error:', error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  async getCharts(req, res) {
    try {
      const charts = await DashboardService.getCharts(req.tenantId);
      return ResponseUtil.success(res, charts, 'Dashboard charts fetched successfully');
    } catch (error) {
      logger.error('Get dashboard charts error:', error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }
}

module.exports = new DashboardController();