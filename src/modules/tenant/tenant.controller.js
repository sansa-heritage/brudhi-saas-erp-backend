const TenantService = require('./tenant.service');
const ResponseUtil = require('../../utils/response');
const logger = require('../../config/logger');

class TenantController {
  async getSettings(req, res) {
    try {
      const settings = await TenantService.getSettings(req.tenantId);
      return ResponseUtil.success(res, settings, 'Tenant settings fetched successfully');
    } catch (error) {
      logger.error('Get tenant settings error:', error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  async updateSettings(req, res) {
    try {
      const settings = await TenantService.updateSettings(req.tenantId, req.body);
      return ResponseUtil.success(res, settings, 'Tenant settings updated successfully');
    } catch (error) {
      logger.error('Update tenant settings error:', error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  async getModules(req, res) {
    try {
      const modules = await TenantService.getModules(req.tenantId);
      return ResponseUtil.success(res, modules, 'Tenant modules fetched successfully');
    } catch (error) {
      logger.error('Get tenant modules error:', error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  async updateModule(req, res) {
    try {
      const { moduleId, isEnabled, settings } = req.body;
      await TenantService.updateModule(req.tenantId, moduleId, isEnabled, settings);
      return ResponseUtil.success(res, null, 'Module updated successfully');
    } catch (error) {
      logger.error('Update module error:', error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  async getTenantInfo(req, res) {
    try {
      const info = await TenantService.getTenantInfo(req.tenantId);
      return ResponseUtil.success(res, info, 'Tenant info fetched successfully');
    } catch (error) {
      logger.error('Get tenant info error:', error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }
}

module.exports = new TenantController();