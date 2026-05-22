const DatabaseManager = require('../../services/database-manager.service');
const moment = require('moment');

class DashboardService {
  async getStats(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    
    try {
      const today = moment().format('YYYY-MM-DD');
      const startOfWeek = moment().startOf('week').format('YYYY-MM-DD');
      const startOfMonth = moment().startOf('month').format('YYYY-MM-DD');
      
      // Today's stats
      const todayStats = await db.query(
        `SELECT 
          COUNT(*) as invoices,
          SUM(total_amount) as revenue,
          COUNT(DISTINCT party_id) as customers
         FROM invoices
         WHERE invoice_date = ?`,
        [today]
      );
      
      // Weekly stats
      const weeklyStats = await db.query(
        `SELECT 
          COUNT(*) as invoices,
          SUM(total_amount) as revenue
         FROM invoices
         WHERE invoice_date >= ?`,
        [startOfWeek]
      );
      
      // Monthly stats
      const monthlyStats = await db.query(
        `SELECT 
          COUNT(*) as invoices,
          SUM(total_amount) as revenue
         FROM invoices
         WHERE invoice_date >= ?`,
        [startOfMonth]
      );
      
      // Total customers
      const totalCustomers = await db.query(
        'SELECT COUNT(*) as count FROM customers WHERE status = "active"'
      );
      
      // Total dealers
      const totalDealers = await db.query(
        'SELECT COUNT(*) as count FROM dealers WHERE status = "active"'
      );
      
      // Low stock count
      const lowStock = await db.query(
        `SELECT COUNT(*) as count FROM gas_stocks 
         WHERE available_stock <= reorder_level`
      );
      
      // Recent invoices
      const recentInvoices = await db.query(
        `SELECT i.*, 
                CASE 
                  WHEN i.party_type = 'customer' THEN c.name
                  ELSE d.name
                END as party_name
         FROM invoices i
         LEFT JOIN customers c ON i.party_type = 'customer' AND i.party_id = c.id
         LEFT JOIN dealers d ON i.party_type = 'dealer' AND i.party_id = d.id
         ORDER BY i.created_at DESC
         LIMIT 10`
      );
      
      return {
        today: {
          invoices: todayStats[0]?.invoices || 0,
          revenue: todayStats[0]?.revenue || 0,
          customers: todayStats[0]?.customers || 0
        },
        weekly: {
          invoices: weeklyStats[0]?.invoices || 0,
          revenue: weeklyStats[0]?.revenue || 0
        },
        monthly: {
          invoices: monthlyStats[0]?.invoices || 0,
          revenue: monthlyStats[0]?.revenue || 0
        },
        totals: {
          customers: totalCustomers[0]?.count || 0,
          dealers: totalDealers[0]?.count || 0,
          low_stock: lowStock[0]?.count || 0
        },
        recent_invoices: recentInvoices
      };
    } finally {
      await db.end();
    }
  }

  async getCharts(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    
    try {
      // Sales chart (last 7 days)
      const salesChart = await db.query(
        `SELECT 
          DATE(invoice_date) as date,
          COUNT(*) as invoice_count,
          SUM(total_amount) as total_sales
         FROM invoices
         WHERE invoice_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
         GROUP BY DATE(invoice_date)
         ORDER BY date ASC`
      );
      
      // Top products
      const topProducts = await db.query(
        `SELECT 
          ct.name as product_name,
          COUNT(ii.id) as sold_count,
          SUM(ii.quantity) as total_quantity,
          SUM(ii.total_amount) as total_revenue
         FROM invoice_items ii
         LEFT JOIN cylinder_types ct ON ii.cylinder_type_id = ct.id
         WHERE ii.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
         GROUP BY ii.cylinder_type_id
         ORDER BY total_revenue DESC
         LIMIT 5`
      );
      
      // Payment status distribution
      const paymentStatus = await db.query(
        `SELECT 
          payment_status,
          COUNT(*) as count,
          SUM(total_amount) as amount
         FROM invoices
         GROUP BY payment_status`
      );
      
      // Monthly revenue trend (last 6 months)
      const revenueTrend = await db.query(
        `SELECT 
          DATE_FORMAT(invoice_date, '%Y-%m') as month,
          COUNT(*) as invoice_count,
          SUM(total_amount) as total_revenue
         FROM invoices
         WHERE invoice_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
         GROUP BY DATE_FORMAT(invoice_date, '%Y-%m')
         ORDER BY month ASC`
      );
      
      return {
        sales_chart: salesChart,
        top_products: topProducts,
        payment_status: paymentStatus,
        revenue_trend: revenueTrend
      };
    } finally {
      await db.end();
    }
  }
}

module.exports = new DashboardService();