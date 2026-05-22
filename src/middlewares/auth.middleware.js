const JWTUtil = require('../utils/jwt');
const ResponseUtil = require('../utils/response');
const db = require('../config/db');
const DatabaseManager = require('../services/database-manager.service');
const logger = require('../config/logger');

class AuthMiddleware {
  static async authenticate(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ResponseUtil.unauthorized(res, 'No token provided');
      }

      const token = authHeader.replace('Bearer ', '');
      const decoded = JWTUtil.verifyToken(token);
      
      if (!decoded) {
        return ResponseUtil.unauthorized(res, 'Invalid or expired token');
      }

      if (decoded.role === 'superadmin') {
        // Superadmin authentication
        const users = await db.query(
          'SELECT id, name, email, role FROM superadmins WHERE id = ? AND status = "active"',
          [decoded.id]
        );
        
        if (users.length === 0) {
          return ResponseUtil.unauthorized(res, 'User not found');
        }
        
        req.user = users[0];
        req.user.role = 'superadmin';
        
      } else if (decoded.tenant_id) {
        // Tenant user authentication
        const tenantDb = await DatabaseManager.getTenantDatabaseConnection(decoded.tenant_id);
        const users = await tenantDb.query(
          'SELECT id, name, email, role FROM users WHERE id = ? AND status = "active"',
          [decoded.id]
        );
        await tenantDb.end();
        
        if (users.length === 0) {
          return ResponseUtil.unauthorized(res, 'User not found');
        }
        
        const tenant = await db.query(
          'SELECT id, name, subdomain, status FROM tenants WHERE id = ?',
          [decoded.tenant_id]
        );
        
        req.user = {
          ...users[0],
          tenant_id: decoded.tenant_id,
          tenant_name: tenant[0]?.name,
          tenant_subdomain: tenant[0]?.tenant_subdomain,
          
        };
      } else {
        return ResponseUtil.unauthorized(res, 'Invalid token payload');
      }
      
      req.token = token;
      next();
      
    } catch (error) {
      logger.error('Authentication error:', error);
      return ResponseUtil.error(res, 'Authentication failed', 500);
    }
  }

  static authorize(...roles) {
    return (req, res, next) => {
      if (!req.user) {
        return ResponseUtil.unauthorized(res, 'User not authenticated');
      }

      if (!roles.includes(req.user.role)) {
        return ResponseUtil.forbidden(res, `Insufficient permissions. Required roles: ${roles.join(', ')}`);
      }

      next();
    };
  }
}

module.exports = AuthMiddleware;  