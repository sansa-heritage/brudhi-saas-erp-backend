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
          COALESCE(SUM(total_amount), 0) as revenue,
          COUNT(DISTINCT party_id) as customers
         FROM invoices
         WHERE DATE(invoice_date) = ?`,
        [today]
      );
      
      // Weekly stats
      const weeklyStats = await db.query(
        `SELECT 
          COUNT(*) as invoices,
          COALESCE(SUM(total_amount), 0) as revenue
         FROM invoices
         WHERE DATE(invoice_date) >= ?`,
        [startOfWeek]
      );
      
      // Monthly stats
      const monthlyStats = await db.query(
        `SELECT 
          COUNT(*) as invoices,
          COALESCE(SUM(total_amount), 0) as revenue
         FROM invoices
         WHERE DATE(invoice_date) >= ?`,
        [startOfMonth]
      );
      
      // Total customers
      const totalCustomers = await db.query(
        `SELECT COUNT(*) as count FROM customers WHERE status = 'active'`
      );
      
      // Total dealers
      const totalDealers = await db.query(
        `SELECT COUNT(*) as count FROM dealers WHERE status = 'active'`
      );
      
      // Total users
      const totalUsers = await db.query(
        `SELECT COUNT(*) as count FROM users WHERE status = 'active'`
      );
      
      // Total staff
      const totalStaff = await db.query(
        `SELECT COUNT(*) as count FROM staff WHERE status = 'active'`
      );
      
      // Low stock count
      const lowStock = await db.query(
        `SELECT COUNT(*) as count FROM gas_stocks 
         WHERE available_stock <= reorder_level AND available_stock > 0`
      );
      
      // Recent invoices
      const recentInvoices = await db.query(
        `SELECT 
          i.id, 
          i.invoice_no, 
          i.invoice_date, 
          i.total_amount, 
          i.payment_status,
          CASE 
            WHEN i.party_type = 'customer' THEN c.name
            WHEN i.party_type = 'dealer' THEN d.name
            ELSE 'Unknown'
          END as party_name,
          i.created_at
         FROM invoices i
         LEFT JOIN customers c ON i.party_type = 'customer' AND i.party_id = c.id
         LEFT JOIN dealers d ON i.party_type = 'dealer' AND i.party_id = d.id
         ORDER BY i.created_at DESC
         LIMIT 10`
      );
      
      // Calculate total sales (all time)
      const totalSales = await db.query(
        `SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE payment_status = 'paid'`
      );
      
      // Calculate tax collected - estimate as 5% of total sales (or adjust based on your business logic)
      // If you have a tax column, use that instead
      const taxCollected = parseFloat(totalSales[0]?.total) * 0.05; // 5% tax estimate
      
      // Calculate total expenses
      const totalExpenses = await db.query(
        `SELECT COALESCE(SUM(amount), 0) as total FROM expenses`
      );
      
      // Get pending invoices count
      const pendingInvoices = await db.query(
        `SELECT COUNT(*) as count FROM invoices WHERE payment_status != 'paid'`
      );
      
      // Get total invoices count
      const totalInvoices = await db.query(
        `SELECT COUNT(*) as count FROM invoices`
      );
      
      return {
        // Existing stats
        today: {
          invoices: Number(todayStats[0]?.invoices) || 0,
          revenue: parseFloat(todayStats[0]?.revenue) || 0,
          customers: Number(todayStats[0]?.customers) || 0
        },
        weekly: {
          invoices: Number(weeklyStats[0]?.invoices) || 0,
          revenue: parseFloat(weeklyStats[0]?.revenue) || 0
        },
        monthly: {
          invoices: Number(monthlyStats[0]?.invoices) || 0,
          revenue: parseFloat(monthlyStats[0]?.revenue) || 0
        },
        totals: {
          customers: Number(totalCustomers[0]?.count) || 0,
          dealers: Number(totalDealers[0]?.count) || 0,
          users: Number(totalUsers[0]?.count) || 0,
          staff: Number(totalStaff[0]?.count) || 0,
          low_stock: Number(lowStock[0]?.count) || 0
        },
        recent_invoices: recentInvoices || [],
        
        // Additional stats for frontend cards
        total_sales: parseFloat(totalSales[0]?.total) || 0,
        tax_collected: taxCollected,
        total_expenses: parseFloat(totalExpenses[0]?.total) || 0,
        pending_invoices: Number(pendingInvoices[0]?.count) || 0,
        total_invoices: Number(totalInvoices[0]?.count) || 0
      };
    } catch (error) {
      console.error('Dashboard stats error:', error);
      throw error;
    } finally {
      await db.end();
    }
  }

  async getCharts(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    
    try {
      // Sales chart - last 7 days (weekly) - without tax
      const weeklySales = await db.query(
        `SELECT 
          DATE_FORMAT(invoice_date, '%a') as name,
          COALESCE(SUM(total_amount), 0) as sales,
          0 as tax
         FROM invoices
         WHERE invoice_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
         GROUP BY DAYOFWEEK(invoice_date)
         ORDER BY DAYOFWEEK(invoice_date) ASC`
      );
      
      // Sales chart - monthly (last 12 months) - without tax
      const monthlySales = await db.query(
        `SELECT 
          DATE_FORMAT(invoice_date, '%b') as name,
          COALESCE(SUM(total_amount), 0) as sales,
          0 as tax
         FROM invoices
         WHERE invoice_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
         GROUP BY MONTH(invoice_date)
         ORDER BY MONTH(invoice_date) ASC`
      );
      
      // Top selling cylinder types
      const topProducts = await db.query(
        `SELECT 
          ct.name as product_name,
          COUNT(ii.id) as sold_count,
          SUM(ii.quantity) as total_quantity,
          COALESCE(SUM(ii.total_amount), 0) as total_revenue
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
          COALESCE(SUM(total_amount), 0) as amount
         FROM invoices
         GROUP BY payment_status`
      );
      
      // Monthly revenue trend - last 6 months
      const revenueTrend = await db.query(
        `SELECT 
          DATE_FORMAT(invoice_date, '%Y-%m') as month,
          COUNT(*) as invoice_count,
          COALESCE(SUM(total_amount), 0) as total_revenue
         FROM invoices
         WHERE invoice_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
         GROUP BY DATE_FORMAT(invoice_date, '%Y-%m')
         ORDER BY month ASC`
      );
      
      // Company vs dealer sales distribution
      const salesDistribution = await db.query(
        `SELECT 
          party_type,
          COUNT(*) as invoice_count,
          COALESCE(SUM(total_amount), 0) as total_amount
         FROM invoices
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
         GROUP BY party_type`
      );
      
      // Top customers by purchase amount
      const topCustomers = await db.query(
        `SELECT 
          c.name as customer_name,
          COUNT(i.id) as invoice_count,
          COALESCE(SUM(i.total_amount), 0) as total_amount
         FROM invoices i
         LEFT JOIN customers c ON i.party_id = c.id
         WHERE i.party_type = 'customer'
           AND i.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
         GROUP BY i.party_id
         ORDER BY total_amount DESC
         LIMIT 5`
      );
      
      // Stock alerts
      const stockAlerts = await db.query(
        `SELECT 
          gs.id,
          ct.name as cylinder_name,
          gs.available_stock,
          gs.reorder_level
         FROM gas_stocks gs
         LEFT JOIN cylinder_types ct ON gs.cylinder_type_id = ct.id
         WHERE gs.available_stock <= gs.reorder_level
           AND gs.available_stock > 0
         ORDER BY gs.available_stock ASC
         LIMIT 10`
      );
      
      // Expense breakdown
      const expenseBreakdown = await db.query(
        `SELECT 
          category as label,
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as amount,
          CONCAT(ROUND((SUM(amount) / NULLIF((SELECT SUM(amount) FROM expenses WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)), 0) * 100), 0), '%') as width
         FROM expenses
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
         GROUP BY category
         ORDER BY amount DESC`
      );
      
      // Total expenses amount
      const totalExpenses = await db.query(
        `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`
      );
      
      // Customer overview stats
      const customerOverview = await db.query(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as new,
          SUM(CASE WHEN created_at < DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as returning
         FROM customers
         WHERE status = 'active'`
      );
      
      return {
        weekly_sales: weeklySales || [],
        monthly_sales: monthlySales || [],
        top_products: topProducts || [],
        payment_status: paymentStatus || [],
        revenue_trend: revenueTrend || [],
        sales_distribution: salesDistribution || [],
        top_customers: topCustomers || [],
        stock_alerts: stockAlerts || [],
        expense_breakdown: expenseBreakdown || [],
        total_expenses: parseFloat(totalExpenses[0]?.total) || 0,
        customer_overview: customerOverview[0] || { total: 0, new: 0, returning: 0 }
      };
    } catch (error) {
      console.error('Dashboard charts error:', error);
      throw error;
    } finally {
      await db.end();
    }
  }

  // Get sales data (weekly or monthly)
  async getSalesData(tenantId, period = 'weekly') {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    
    try {
      let salesData = [];
      
      if (period === 'weekly') {
        salesData = await db.query(
          `SELECT 
            DATE_FORMAT(invoice_date, '%a') as name,
            COALESCE(SUM(total_amount), 0) as sales,
            0 as tax
           FROM invoices
           WHERE invoice_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
           GROUP BY DAYOFWEEK(invoice_date)
           ORDER BY DAYOFWEEK(invoice_date) ASC`
        );
        
        // If no data, return empty data structure
        if (!salesData || salesData.length === 0) {
          salesData = [
            { name: "Mon", sales: 0, tax: 0 },
            { name: "Tue", sales: 0, tax: 0 },
            { name: "Wed", sales: 0, tax: 0 },
            { name: "Thu", sales: 0, tax: 0 },
            { name: "Fri", sales: 0, tax: 0 },
            { name: "Sat", sales: 0, tax: 0 },
            { name: "Sun", sales: 0, tax: 0 }
          ];
        }
      } else {
        salesData = await db.query(
          `SELECT 
            DATE_FORMAT(invoice_date, '%b') as name,
            COALESCE(SUM(total_amount), 0) as sales,
            0 as tax
           FROM invoices
           WHERE invoice_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
           GROUP BY MONTH(invoice_date)
           ORDER BY MONTH(invoice_date) ASC`
        );
        
        // If no data, return empty data structure
        if (!salesData || salesData.length === 0) {
          salesData = [
            { name: "Jan", sales: 0, tax: 0 },
            { name: "Feb", sales: 0, tax: 0 },
            { name: "Mar", sales: 0, tax: 0 },
            { name: "Apr", sales: 0, tax: 0 },
            { name: "May", sales: 0, tax: 0 },
            { name: "Jun", sales: 0, tax: 0 },
            { name: "Jul", sales: 0, tax: 0 },
            { name: "Aug", sales: 0, tax: 0 },
            { name: "Sep", sales: 0, tax: 0 },
            { name: "Oct", sales: 0, tax: 0 },
            { name: "Nov", sales: 0, tax: 0 },
            { name: "Dec", sales: 0, tax: 0 }
          ];
        }
      }
      
      return { salesData };
    } catch (error) {
      console.error('Get sales data error:', error);
      throw error;
    } finally {
      await db.end();
    }
  }

  // Get recent invoices
  async getRecentInvoices(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    
    try {
      const invoices = await db.query(
        `SELECT 
          invoice_no as invoice,
          CASE 
            WHEN party_type = 'customer' THEN c.name
            WHEN party_type = 'dealer' THEN d.name
            ELSE 'Unknown'
          END as company,
          CONCAT('₹', FORMAT(total_amount, 0)) as amount,
          DATE_FORMAT(invoice_date, '%d %b %Y') as date,
          payment_status as status,
          CASE 
            WHEN payment_status = 'Paid' OR payment_status = 'paid' THEN '#D1FAE5'
            ELSE '#FEF3C7'
          END as statusBg,
          CASE 
            WHEN payment_status = 'Paid' OR payment_status = 'paid' THEN '#059669'
            ELSE '#D97706'
          END as statusColor
         FROM invoices i
         LEFT JOIN customers c ON i.party_type = 'customer' AND i.party_id = c.id
         LEFT JOIN dealers d ON i.party_type = 'dealer' AND i.party_id = d.id
         ORDER BY i.created_at DESC
         LIMIT 5`
      );
      
      // Transform status to match frontend expected format (Paid/Pending)
      const transformedInvoices = invoices.map(inv => ({
        ...inv,
        status: inv.status === 'paid' || inv.status === 'Paid' ? 'Paid' : 'Pending'
      }));
      
      return { invoices: transformedInvoices };
    } catch (error) {
      console.error('Get recent invoices error:', error);
      throw error;
    } finally {
      await db.end();
    }
  }

  // Get customer overview
  async getCustomerOverview(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    
    try {
      const customers = await db.query(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as new,
          SUM(CASE WHEN created_at < DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as returning
         FROM customers
         WHERE status = 'active'`
      );
      
      return { 
        customers: {
          total: Number(customers[0]?.total) || 0,
          new: Number(customers[0]?.new) || 0,
          returning: Number(customers[0]?.returning) || 0
        }
      };
    } catch (error) {
      console.error('Get customer overview error:', error);
      throw error;
    } finally {
      await db.end();
    }
  }

  // Get expense summary
  async getExpenseSummary(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    
    try {
      // Get total expenses
      const totalExpensesResult = await db.query(
        `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`
      );
      
      // Get expense breakdown
      const breakdown = await db.query(
        `SELECT 
          category as label,
          CONCAT(ROUND((SUM(amount) / NULLIF((SELECT SUM(amount) FROM expenses WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)), 0) * 100), 0), '%') as width,
          SUM(amount) as amount
         FROM expenses
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
         GROUP BY category
         ORDER BY amount DESC`
      );
      
      const totalExpenses = parseFloat(totalExpensesResult[0]?.total) || 0;
      
      // If no expenses found, return default structure
      if (breakdown.length === 0) {
        return {
          expenses: {
            total: 0,
            breakdown: []
          }
        };
      }
      
      return {
        expenses: {
          total: totalExpenses,
          breakdown: breakdown
        }
      };
    } catch (error) {
      console.error('Get expense summary error:', error);
      throw error;
    } finally {
      await db.end();
    }
  }
}

module.exports = new DashboardService();