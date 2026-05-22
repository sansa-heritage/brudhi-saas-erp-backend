const DatabaseManager = require('../../services/database-manager.service');
const db = require('../../config/db');

class TenantService {
  async getSettings(tenantId) {
    const tenant = await db.query(
      'SELECT config FROM tenants WHERE id = ?',
      [tenantId]
    );
    
    return tenant[0]?.config || {};
  }

  async updateSettings(tenantId, settings) {
    const tenant = await db.query(
      'SELECT config FROM tenants WHERE id = ?',
      [tenantId]
    );
    
    const currentConfig = tenant[0]?.config || {};
    const newConfig = { ...currentConfig, ...settings };
    
    await db.query(
      'UPDATE tenants SET config = ? WHERE id = ?',
      [JSON.stringify(newConfig), tenantId]
    );
    
    return newConfig;
  }

  async getModules(tenantId) {
    const modules = await db.query(
      `SELECT m.*, tm.is_enabled, tm.settings
       FROM modules m
       LEFT JOIN tenant_modules tm ON m.id = tm.module_id AND tm.tenant_id = ?
       WHERE m.is_active = true
       ORDER BY m.sort_order`,
      [tenantId]
    );
    
    return modules;
  }

  async updateModule(tenantId, moduleId, isEnabled, settings) {
    await db.query(
      `INSERT INTO tenant_modules (tenant_id, module_id, is_enabled, settings)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       is_enabled = VALUES(is_enabled),
       settings = VALUES(settings),
       updated_at = NOW()`,
      [tenantId, moduleId, isEnabled, JSON.stringify(settings)]
    );
    
    return true;
  }

  async getTenantInfo(tenantId) {
    const tenant = await db.query(
      'SELECT id, name, subdomain, email, phone, status, subscription_status, trial_ends_at, created_at FROM tenants WHERE id = ?',
      [tenantId]
    );
    
    return tenant[0] || null;
  }
}

module.exports = new TenantService();