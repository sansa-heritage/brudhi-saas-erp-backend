const DatabaseManager = require('../../services/database-manager.service');
const moment = require('moment');

class ReportService {
  async getSalesReport(tenantId, fromDate, toDate) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    
    try {
      const query = `
        SELECT 
          DATE(i.invoice_date) as date,
          i.party_type,
          COUNT(*) as invoice_count,
          SUM(i.total_amount) as total_amount,
          SUM(i.gst_amount) as total_gst,
          AVG(i.total_amount) as average_invoice_value
        FROM invoices i
        WHERE i.invoice_date BETWEEN ? AND ?
          AND i.payment_status = 'paid'
        GROUP BY DATE(i.invoice_date), i.party_type
        ORDER BY date DESC
      `;
      
      const sales = await db.query(query, [fromDate, toDate]);
      return sales;
    } finally {
      await db.end();
    }
  }

  async getStockReport(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    
    try {
      const query = `
        SELECT 
          ct.name as cylinder_name,
          ct.weight,
          ct.type,
          gs.total_stock,
          gs.available_stock,
          gs.damaged_stock,
          gs.returned_stock,
          gs.min_stock_level,
          gs.reorder_level,
          CASE 
            WHEN gs.available_stock <= gs.reorder_level THEN 'Low Stock'
            WHEN gs.available_stock <= gs.min_stock_level THEN 'Critical'
            ELSE 'Sufficient'
          END as stock_status
        FROM gas_stocks gs
        LEFT JOIN cylinder_types ct ON gs.cylinder_type_id = ct.id
        ORDER BY ct.weight ASC
      `;
      
      const stock = await db.query(query);
      return stock;
    } finally {
      await db.end();
    }
  }

  async getFinancialReport(tenantId, fromDate, toDate) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    
    try {
      // Sales summary
      const sales = await db.query(
        `SELECT 
          COUNT(*) as total_invoices,
          SUM(total_amount) as total_sales,
          SUM(gst_amount) as total_gst,
          AVG(total_amount) as avg_invoice_value
         FROM invoices
         WHERE invoice_date BETWEEN ? AND ?
           AND payment_status = 'paid'`,
        [fromDate, toDate]
      );
      
      // Expenses summary
      const expenses = await db.query(
        `SELECT 
          COUNT(*) as total_expenses,
          SUM(amount) as total_expense_amount,
          category,
          SUM(amount) as category_amount
         FROM expenses
         WHERE expense_date BETWEEN ? AND ?
         GROUP BY category
         ORDER BY category_amount DESC`,
        [fromDate, toDate]
      );
      
      // Outstanding payments
      const outstanding = await db.query(
        `SELECT 
          COUNT(*) as total_outstanding_invoices,
          SUM(balance_amount) as total_outstanding_amount
         FROM invoices
         WHERE payment_status IN ('unpaid', 'partial')
           AND invoice_date <= ?`,
        [toDate]
      );
      
      return {
        sales: sales[0],
        expenses,
        outstanding: outstanding[0],
        profit_loss: {
          total_revenue: sales[0]?.total_sales || 0,
          total_expenses: expenses.reduce((sum, e) => sum + e.total_expense_amount, 0),
          net_profit: (sales[0]?.total_sales || 0) - expenses.reduce((sum, e) => sum + e.total_expense_amount, 0)
        }
      };
    } finally {
      await db.end();
    }
  }

  async getCustomerReport(tenantId, customerId, fromDate, toDate) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    
    try {
      const query = `
        SELECT 
          i.*,
          COUNT(ii.id) as item_count,
          SUM(ii.quantity) as total_cylinders
        FROM invoices i
        LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
        WHERE i.party_type = 'customer'
          AND i.party_id = ?
          AND i.invoice_date BETWEEN ? AND ?
        GROUP BY i.id
        ORDER BY i.invoice_date DESC
      `;
      
      const invoices = await db.query(query, [customerId, fromDate, toDate]);
      
      const summary = await db.query(
        `SELECT 
          COUNT(*) as total_invoices,
          SUM(total_amount) as total_purchases,
          AVG(total_amount) as avg_invoice_value,
          MAX(invoice_date) as last_purchase_date
         FROM invoices
         WHERE party_type = 'customer'
           AND party_id = ?
           AND invoice_date BETWEEN ? AND ?
           AND payment_status = 'paid'`,
        [customerId, fromDate, toDate]
      );
      
      return {
        summary: summary[0],
        invoices
      };
    } finally {
      await db.end();
    }
  }

  async getDashboardSummary(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    
    try {
      const today = moment().format('YYYY-MM-DD');
      const startOfMonth = moment().startOf('month').format('YYYY-MM-DD');
      
      // Today's statistics
      const todayStats = await db.query(
        `SELECT 
          COUNT(*) as total_invoices,
          SUM(total_amount) as total_sales
         FROM invoices
         WHERE invoice_date = ?`,
        [today]
      );
      
      // Monthly statistics
      const monthlyStats = await db.query(
        `SELECT 
          COUNT(*) as total_invoices,
          SUM(total_amount) as total_sales,
          COUNT(DISTINCT party_id) as unique_customers
         FROM invoices
         WHERE invoice_date >= ?`,
        [startOfMonth]
      );
      
      // Low stock items
      const lowStock = await db.query(
        `SELECT ct.name, gs.available_stock, gs.reorder_level
         FROM gas_stocks gs
         LEFT JOIN cylinder_types ct ON gs.cylinder_type_id = ct.id
         WHERE gs.available_stock <= gs.reorder_level`
      );
      
      // Recent activities
      const recentActivities = await db.query(
        `SELECT * FROM activity_logs 
         ORDER BY created_at DESC 
         LIMIT 10`
      );
      
      return {
        today: {
          invoices: todayStats[0]?.total_invoices || 0,
          sales: todayStats[0]?.total_sales || 0
        },
        monthly: {
          invoices: monthlyStats[0]?.total_invoices || 0,
          sales: monthlyStats[0]?.total_sales || 0,
          customers: monthlyStats[0]?.unique_customers || 0
        },
        low_stock_count: lowStock.length,
        low_stock_items: lowStock,
        recent_activities: recentActivities
      };
    } finally {
      await db.end();
    }
  }
}

module.exports = new ReportService();