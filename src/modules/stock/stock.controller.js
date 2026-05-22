const StockService = require('./stock.service');
const ResponseUtil = require('../../utils/response');
const logger = require('../../config/logger');

class StockController {
  async getAllStock(req, res) {
    try {
      const filters = {
        cylinderTypeId: req.query.cylinderTypeId,
        brandId: req.query.brandId,
        lowStock: req.query.lowStock
      };
      
      const result = await StockService.getAllStock(req.tenantId, filters);
      return ResponseUtil.success(res, result, 'Stock fetched successfully');
    } catch (error) {
      logger.error('Get all stock error:', error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  async getStockById(req, res) {
    try {
      const stock = await StockService.getStockById(req.tenantId, req.params.id);
      if (!stock) {
        return ResponseUtil.notFound(res, 'Stock not found');
      }
      return ResponseUtil.success(res, stock, 'Stock fetched successfully');
    } catch (error) {
      logger.error('Get stock by id error:', error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  async createStock(req, res) {
    try {
      const stockData = { ...req.body, createdBy: req.user.id };
      const stockId = await StockService.createStock(req.tenantId, stockData);
      const stock = await StockService.getStockById(req.tenantId, stockId);
      return ResponseUtil.created(res, stock, 'Stock created successfully');
    } catch (error) {
      logger.error('Create stock error:', error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  async updateStock(req, res) {
    try {
      const stockData = { ...req.body, updatedBy: req.user.id };
      await StockService.updateStock(req.tenantId, req.params.id, stockData);
      const stock = await StockService.getStockById(req.tenantId, req.params.id);
      return ResponseUtil.success(res, stock, 'Stock updated successfully');
    } catch (error) {
      logger.error('Update stock error:', error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  async deleteStock(req, res) {
    try {
      await StockService.deleteStock(req.tenantId, req.params.id);
      return ResponseUtil.success(res, null, 'Stock deleted successfully');
    } catch (error) {
      logger.error('Delete stock error:', error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  async getStockTransactions(req, res) {
    try {
      const filters = {
        transactionType: req.query.transactionType,
        page: req.query.page,
        limit: req.query.limit
      };
      
      const result = await StockService.getStockTransactions(
        req.tenantId,
        req.params.stockId,
        filters
      );
      return ResponseUtil.success(res, result, 'Stock transactions fetched successfully');
    } catch (error) {
      logger.error('Get stock transactions error:', error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }
}

module.exports = new StockController();