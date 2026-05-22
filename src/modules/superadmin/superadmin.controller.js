const SuperadminService = require('./superadmin.service');
const ResponseUtil = require('../../utils/response');
const logger = require('../../config/logger');

class SuperadminController {
  async getAllTenants(req, res) {
    try {
      const filters = {
        status: req.query.status,
        search: req.query.search,
        page: req.query.page,
        limit: req.query.limit
      };

      const result = await SuperadminService.getAllTenants(filters);
      return ResponseUtil.success(res, result, 'Tenants fetched successfully');
    } catch (error) {
      logger.error('Get all tenants error:', error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  async getTenantById(req, res) {
    try {
      const tenant = await SuperadminService.getTenantById(req.params.id);

      if (!tenant) {
        return ResponseUtil.notFound(res, 'Tenant not found');
      }

      return ResponseUtil.success(res, tenant, 'Tenant fetched successfully');
    } catch (error) {
      logger.error('Get tenant by id error:', error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  async createTenant(req, res) {
    try {
      const tenantData = {
        name: req.body.name,
        subdomain: req.body.subdomain,
        email: req.body.email,
        phone: req.body.phone,
        subscriptionPlanId: req.body.subscriptionPlanId,
        trialDays: req.body.trialDays,
        adminName: req.body.adminName,
        adminEmail: req.body.adminEmail,
        adminPassword: req.body.adminPassword,
        adminMobile: req.body.adminMobile,
        config: req.body.config,
        createdBy: req.user.id,
        ipAddress: req.ip
      };

      const result = await SuperadminService.createTenant(tenantData);

      return ResponseUtil.created(res, result, 'Tenant created with separate database successfully');
    } catch (error) {
      logger.error('Create tenant error:', error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  async getTenantDatabaseInfo(req, res) {
    try {
      const info = await SuperadminService.getTenantDatabaseInfo(req.params.id);
      return ResponseUtil.success(res, info, 'Tenant database info fetched successfully');
    } catch (error) {
      logger.error('Get tenant database info error:', error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  async backupTenantDatabase(req, res) {
    try {
      const backup = await SuperadminService.backupTenantDatabase(req.params.id);
      return ResponseUtil.success(res, backup, 'Tenant database backup created successfully');
    } catch (error) {
      logger.error('Backup tenant database error:', error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  async deleteTenant(req, res) {
    try {
      await SuperadminService.deleteTenant(req.params.id);
      return ResponseUtil.success(res, null, 'Tenant deleted successfully');
    } catch (error) {
      logger.error('Delete tenant error:', error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }
  async updateTenant(req, res) {
    try {
      const tenantId = parseInt(req.params.id);
      const updateData = {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        status: req.body.status,
        subscription_status: req.body.subscription_status
      };

      // Remove undefined fields
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      await SuperadminService.updateTenant(tenantId, updateData);
      const tenant = await SuperadminService.getTenantById(tenantId);

      return ResponseUtil.success(res, tenant, 'Tenant updated successfully');
    } catch (error) {
      logger.error('Update tenant error:', error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  async updateTenantStatus(req, res) {
    try {
      const { status } = req.body;
      await SuperadminService.updateTenantStatus(req.params.id, status);
      const tenant = await SuperadminService.getTenantById(req.params.id);
      return ResponseUtil.success(res, tenant, `Tenant ${status} successfully`);
    } catch (error) {
      logger.error('Update tenant status error:', error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  async updateTenantSubscription(req, res) {
    try {
      const { planId, duration } = req.body;
      const subscriptionId = await SuperadminService.updateTenantSubscription(
        req.params.id,
        planId,
        duration
      );
      return ResponseUtil.success(res, { subscriptionId }, 'Subscription updated successfully');
    } catch (error) {
      logger.error('Update tenant subscription error:', error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  async getTenantSubscription(req, res) {
    try {
      const subscription = await SuperadminService.getTenantSubscription(req.params.id);
      return ResponseUtil.success(res, subscription, 'Tenant subscription fetched successfully');
    } catch (error) {
      logger.error('Get tenant subscription error:', error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  // Assign plan to tenant
  async assignPlanToTenant(req, res) {
    try {
      const { planId, duration, startDate } = req.body;
      const result = await SuperadminService.assignPlanToTenant(
        req.params.id,
        planId,
        duration || 30,
        startDate
      );
      return ResponseUtil.success(res, result, 'Plan assigned successfully');
    } catch (error) {
      logger.error('Assign plan to tenant error:', error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  // Get tenant subscription history
  async getTenantSubscriptionHistory(req, res) {
    try {
      const history = await SuperadminService.getTenantSubscriptionHistory(req.params.id);
      return ResponseUtil.success(res, history, 'Subscription history fetched successfully');
    } catch (error) {
      logger.error('Get tenant subscription history error:', error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  // Cancel tenant subscription
  async cancelTenantSubscription(req, res) {
    try {
      const { reason, cancelImmediately } = req.body;
      const result = await SuperadminService.cancelTenantSubscription(
        req.params.id,
        reason,
        cancelImmediately || false
      );
      return ResponseUtil.success(res, result, 'Subscription cancelled successfully');
    } catch (error) {
      logger.error('Cancel tenant subscription error:', error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  // Get all subscriptions across all tenants
  async getAllSubscriptions(req, res) {
    try {
      const filters = {
        status: req.query.status,
        planId: req.query.planId,
        tenantId: req.query.tenantId,
        page: req.query.page,
        limit: req.query.limit,
        fromDate: req.query.fromDate,
        toDate: req.query.toDate
      };

      const result = await SuperadminService.getAllSubscriptions(filters);
      return ResponseUtil.success(res, result, 'Subscriptions fetched successfully');
    } catch (error) {
      logger.error('Get all subscriptions error:', error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  // Get subscription statistics
  async getSubscriptionStats(req, res) {
    try {
      const stats = await SuperadminService.getSubscriptionStats();
      return ResponseUtil.success(res, stats, 'Subscription statistics fetched successfully');
    } catch (error) {
      logger.error('Get subscription stats error:', error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  // Get subscriptions by plan
  async getSubscriptionsByPlan(req, res) {
    try {
      const subscriptions = await SuperadminService.getSubscriptionsByPlan(req.params.planId);
      return ResponseUtil.success(res, subscriptions, 'Subscriptions fetched successfully');
    } catch (error) {
      logger.error('Get subscriptions by plan error:', error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  // Get expiring subscriptions
  async getExpiringSubscriptions(req, res) {
    try {
      const days = req.query.days || 7;
      const subscriptions = await SuperadminService.getExpiringSubscriptions(days);
      return ResponseUtil.success(res, subscriptions, `Subscriptions expiring in ${days} days fetched successfully`);
    } catch (error) {
      logger.error('Get expiring subscriptions error:', error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  // Get expired subscriptions
  async getExpiredSubscriptions(req, res) {
    try {
      const subscriptions = await SuperadminService.getExpiredSubscriptions();
      return ResponseUtil.success(res, subscriptions, 'Expired subscriptions fetched successfully');
    } catch (error) {
      logger.error('Get expired subscriptions error:', error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  // Bulk assign plan to multiple tenants
  async bulkAssignPlan(req, res) {
    try {
      const { tenantIds, planId, duration, startDate } = req.body;
      const result = await SuperadminService.bulkAssignPlan(tenantIds, planId, duration, startDate);
      return ResponseUtil.success(res, result, 'Bulk plan assignment completed successfully');
    } catch (error) {
      logger.error('Bulk assign plan error:', error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }
}

module.exports = new SuperadminController();