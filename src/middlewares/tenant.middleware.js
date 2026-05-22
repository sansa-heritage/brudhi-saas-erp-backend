const DatabaseManager = require('../services/database-manager.service');
const ResponseUtil = require('../utils/response');
const logger = require('../config/logger');

class TenantMiddleware {
  static async setTenantContext(req, res, next) {
    try {
      const tenantId = req.headers['x-tenant-id'] || req.params.tenantId || req.user?.tenant_id;
      
      if (!tenantId && req.user?.role !== 'superadmin') {
        return ResponseUtil.badRequest(res, 'Tenant context required');
      }
      
      if (tenantId) {
        req.tenantDb = await DatabaseManager.getTenantDatabaseConnection(tenantId);
        req.tenantId = tenantId;
      }
      
      next();
    } catch (error) {
      logger.error('Tenant middleware error:', error);
      return ResponseUtil.error(res, 'Tenant context error', 500);
    }
  }

  static async cleanupTenantDb(req, res, next) {
    res.on('finish', async () => {
      if (req.tenantDb) {
        await req.tenantDb.end();
      }
    });
    next();
  }
}

module.exports = TenantMiddleware;