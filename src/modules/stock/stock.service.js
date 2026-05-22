const DatabaseManager = require('../../services/database-manager.service');

class StockService {
  async getAllStock(tenantId, filters = {}) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    
    try {
      let query = `
        SELECT gs.*, ct.name as cylinder_name, ct.weight, ct.type,
               ct.price as base_price, ct.gst_percent
        FROM gas_stocks gs
        LEFT JOIN cylinder_types ct ON gs.cylinder_type_id = ct.id
        WHERE 1=1
      `;
      const params = [];

      if (filters.cylinderTypeId) {
        query += ' AND gs.cylinder_type_id = ?';
        params.push(parseInt(filters.cylinderTypeId));
      }

      if (filters.brandId) {
        query += ' AND gs.brand_id = ?';
        params.push(parseInt(filters.brandId));
      }

      if (filters.lowStock === 'true') {
        query += ' AND gs.available_stock <= gs.reorder_level';
      }

      query += ' ORDER BY ct.weight ASC';

      const stock = await db.query(query, params);
      return stock;
    } finally {
      await db.end();
    }
  }

  async getStockById(tenantId, id) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    
    try {
      const stock = await db.query(
        `SELECT gs.*, ct.name as cylinder_name, ct.weight, ct.type
         FROM gas_stocks gs
         LEFT JOIN cylinder_types ct ON gs.cylinder_type_id = ct.id
         WHERE gs.id = ?`,
        [parseInt(id)]
      );
      return stock[0] || null;
    } finally {
      await db.end();
    }
  }

  async createStock(tenantId, stockData) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    
    try {
      const existing = await db.query(
        'SELECT id FROM gas_stocks WHERE cylinder_type_id = ? AND brand_id = ?',
        [stockData.cylinderTypeId, stockData.brandId || null]
      );

      if (existing.length > 0) {
        throw new Error('Stock already exists for this cylinder type');
      }

      const result = await db.query(
        `INSERT INTO gas_stocks (cylinder_type_id, brand_id, total_stock, available_stock,
         min_stock_level, reorder_level, last_updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          stockData.cylinderTypeId,
          stockData.brandId || null,
          stockData.totalStock || 0,
          stockData.availableStock || 0,
          stockData.minStockLevel || 10,
          stockData.reorderLevel || 50,
          stockData.createdBy
        ]
      );

      // Log transaction
      await db.query(
        `INSERT INTO stock_transactions (stock_id, transaction_type, quantity, 
         previous_stock, new_stock, created_by)
         VALUES (?, 'purchase', ?, 0, ?, ?)`,
        [result.insertId, stockData.totalStock || 0, stockData.totalStock || 0, stockData.createdBy]
      );

      return result.insertId;
    } finally {
      await db.end();
    }
  }

  async updateStock(tenantId, id, stockData) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    
    try {
      const updates = [];
      const params = [];

      if (stockData.totalStock !== undefined) {
        const current = await db.query('SELECT total_stock FROM gas_stocks WHERE id = ?', [parseInt(id)]);
        const diff = stockData.totalStock - (current[0]?.total_stock || 0);
        
        updates.push('total_stock = ?');
        params.push(stockData.totalStock);
        
        if (diff !== 0) {
          await db.query(
            `INSERT INTO stock_transactions (stock_id, transaction_type, quantity, 
             previous_stock, new_stock, created_by)
             VALUES (?, 'adjustment', ?, ?, ?, ?)`,
            [id, diff, current[0]?.total_stock || 0, stockData.totalStock, stockData.updatedBy]
          );
        }
      }

      if (stockData.availableStock !== undefined) {
        updates.push('available_stock = ?');
        params.push(stockData.availableStock);
      }

      if (stockData.minStockLevel !== undefined) {
        updates.push('min_stock_level = ?');
        params.push(stockData.minStockLevel);
      }

      if (stockData.reorderLevel !== undefined) {
        updates.push('reorder_level = ?');
        params.push(stockData.reorderLevel);
      }

      if (updates.length === 0) return true;

      updates.push('last_updated_by = ?');
      params.push(stockData.updatedBy);
      params.push(parseInt(id));

      await db.query(
        `UPDATE gas_stocks SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        params
      );

      return true;
    } finally {
      await db.end();
    }
  }

  async deleteStock(tenantId, id) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    
    try {
      await db.query('DELETE FROM gas_stocks WHERE id = ?', [parseInt(id)]);
      return true;
    } finally {
      await db.end();
    }
  }

  async getStockTransactions(tenantId, stockId, filters = {}) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    
    try {
      let query = 'SELECT * FROM stock_transactions WHERE stock_id = ?';
      const params = [parseInt(stockId)];

      if (filters.transactionType) {
        query += ' AND transaction_type = ?';
        params.push(filters.transactionType);
      }

      query += ' ORDER BY created_at DESC';

      const page = parseInt(filters.page) || 1;
      const limit = Math.min(100, parseInt(filters.limit) || 20);
      const offset = (page - 1) * limit;
      query += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const transactions = await db.query(query, params);

      const countResult = await db.query(
        'SELECT COUNT(*) as total FROM stock_transactions WHERE stock_id = ?',
        [parseInt(stockId)]
      );
      const total = countResult[0]?.total || 0;

      return {
        data: transactions,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      };
    } finally {
      await db.end();
    }
  }
}

module.exports = new StockService();