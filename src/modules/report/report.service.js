const DatabaseManager = require("../../services/database-manager.service");
const moment = require("moment");
const PDFDocument = require("pdfkit");

class ReportService {
  // Get Sales Report Data
  async getSalesReport(tenantId, fromDate, toDate) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      // Get monthly sales data
      const monthlyQuery = `
      SELECT 
        DATE_FORMAT(i.invoice_date, '%b') as month,
        MONTH(i.invoice_date) as month_num,
        COUNT(DISTINCT i.id) as invoice_count,
        COALESCE(SUM(i.total_amount), 0) as total_sales,
        COALESCE(SUM(i.gst_amount), 0) as total_gst,
        COALESCE(AVG(i.total_amount), 0) as average_invoice_value
      FROM invoices i
      WHERE i.invoice_date BETWEEN ? AND ?
        AND i.payment_status = 'paid'
      GROUP BY DATE_FORMAT(i.invoice_date, '%b'), MONTH(i.invoice_date)
      ORDER BY month_num ASC
    `;

      let monthlySales = await db.query(monthlyQuery, [fromDate, toDate]);

      // Extract actual data from nested array if needed
      if (
        Array.isArray(monthlySales) &&
        monthlySales.length > 0 &&
        monthlySales[0] &&
        Array.isArray(monthlySales[0])
      ) {
        monthlySales = monthlySales[0];
      }

      // Get daily sales
      const dailyQuery = `
      SELECT 
        DATE(i.invoice_date) as date,
        DAY(i.invoice_date) as day,
        COALESCE(SUM(i.total_amount), 0) as daily_sales,
        COUNT(*) as invoice_count
      FROM invoices i
      WHERE i.invoice_date BETWEEN ? AND ?
        AND i.payment_status = 'paid'
      GROUP BY DATE(i.invoice_date), DAY(i.invoice_date)
      ORDER BY date ASC
    `;

      let dailySales = await db.query(dailyQuery, [fromDate, toDate]);

      // Extract actual data from nested array if needed
      if (
        Array.isArray(dailySales) &&
        dailySales.length > 0 &&
        dailySales[0] &&
        Array.isArray(dailySales[0])
      ) {
        dailySales = dailySales[0];
      }

      // Get summary statistics
      const summaryQuery = `
      SELECT 
        COALESCE(SUM(total_amount), 0) as total_sales,
        COALESCE(SUM(gst_amount), 0) as total_gst,
        COUNT(*) as total_invoices,
        COALESCE(AVG(total_amount), 0) as avg_invoice_value,
        COUNT(DISTINCT party_id) as unique_customers
      FROM invoices
      WHERE invoice_date BETWEEN ? AND ?
        AND payment_status = 'paid'
    `;

      let summary = await db.query(summaryQuery, [fromDate, toDate]);

      // Extract actual data from nested array if needed
      if (
        Array.isArray(summary) &&
        summary.length > 0 &&
        summary[0] &&
        Array.isArray(summary[0])
      ) {
        summary = summary[0];
      }

      // Format monthly data properly
      const formattedMonthlyData = monthlySales.map((item) => ({
        month: item.month,
        month_num: Number(item.month_num),
        invoice_count: Number(item.invoice_count),
        total_sales: parseFloat(item.total_sales) || 0,
        total_gst: parseFloat(item.total_gst) || 0,
        average_invoice_value: parseFloat(item.average_invoice_value) || 0,
      }));

      // Format daily data properly
      const formattedDailyData = dailySales.map((item) => ({
        date: item.date,
        day: Number(item.day),
        daily_sales: parseFloat(item.daily_sales) || 0,
        invoice_count: Number(item.invoice_count),
      }));

      // Format summary properly
      const formattedSummary = summary.map((item) => ({
        total_sales: parseFloat(item.total_sales) || 0,
        total_gst: parseFloat(item.total_gst) || 0,
        total_invoices: Number(item.total_invoices) || 0,
        avg_invoice_value: parseFloat(item.avg_invoice_value) || 0,
        unique_customers: Number(item.unique_customers) || 0,
      }));

      // Get top products (simplified to avoid errors)
      let topProducts = [];
      try {
        const topProductsQuery = `
        SELECT 
          ii.product_id,
          SUM(ii.quantity) as total_quantity,
          SUM(ii.total_amount) as total_amount
        FROM invoice_items ii
        JOIN invoices i ON ii.invoice_id = i.id
        WHERE i.invoice_date BETWEEN ? AND ?
          AND i.payment_status = 'paid'
        GROUP BY ii.product_id
        ORDER BY total_amount DESC
        LIMIT 5
      `;

        const productStats = await db.query(topProductsQuery, [
          fromDate,
          toDate,
        ]);

        if (productStats && productStats.length > 0) {
          // Get product names for these IDs
          const productIds = productStats.map((p) => p.product_id).join(",");
          if (productIds) {
            const productNamesQuery = `
            SELECT id, COALESCE(product_name, name, 'Product') as product_name
            FROM products
            WHERE id IN (${productIds})
          `;
            const productNames = await db.query(productNamesQuery);

            topProducts = productStats.map((stat) => ({
              product_name:
                productNames.find((p) => p.id === stat.product_id)
                  ?.product_name || `Product ${stat.product_id}`,
              total_quantity: Number(stat.total_quantity) || 0,
              total_amount: parseFloat(stat.total_amount) || 0,
            }));
          }
        }
      } catch (error) {
        console.warn("Could not fetch top products:", error.message);
      }

      return {
        summary: formattedSummary,
        monthly_data: formattedMonthlyData,
        daily_data: formattedDailyData,
        top_products: topProducts,
      };
    } catch (error) {
      console.error("Get sales report error:", error);
      throw error;
    } finally {
      await db.end();
    }
  }
  async getStockReport(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      const query = `
        SELECT 
          ct.id as cylinder_type_id,
          ct.name as cylinder_name,
          ct.weight,
          ct.type,
          ct.unit_price,
          COALESCE(gs.total_stock, 0) as total_stock,
          COALESCE(gs.available_stock, 0) as available_stock,
          COALESCE(gs.damaged_stock, 0) as damaged_stock,
          COALESCE(gs.returned_stock, 0) as returned_stock,
          COALESCE(gs.min_stock_level, 10) as min_stock_level,
          COALESCE(gs.reorder_level, 20) as reorder_level,
          CASE 
            WHEN COALESCE(gs.available_stock, 0) <= COALESCE(gs.reorder_level, 20) THEN 'Low Stock'
            WHEN COALESCE(gs.available_stock, 0) <= COALESCE(gs.min_stock_level, 10) THEN 'Critical'
            ELSE 'Sufficient'
          END as stock_status,
          ROUND(COALESCE(gs.available_stock, 0) * COALESCE(ct.unit_price, 0), 2) as stock_value
        FROM cylinder_types ct
        LEFT JOIN gas_stocks gs ON ct.id = gs.cylinder_type_id
        ORDER BY ct.weight ASC
      `;

      const stock = await db.query(query);

      const summary = {
        total_items: stock.length,
        low_stock_items: stock.filter(
          (item) => item.stock_status === "Low Stock",
        ).length,
        critical_items: stock.filter((item) => item.stock_status === "Critical")
          .length,
        total_stock_value: stock.reduce(
          (sum, item) => sum + (item.stock_value || 0),
          0,
        ),
        total_available_stock: stock.reduce(
          (sum, item) => sum + (item.available_stock || 0),
          0,
        ),
      };

      return {
        summary,
        stock_items: stock,
      };
    } catch (error) {
      console.error("Get stock report error:", error);
      throw error;
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
          COALESCE(SUM(total_amount), 0) as total_sales,
          COALESCE(SUM(gst_amount), 0) as total_gst,
          COALESCE(AVG(total_amount), 0) as avg_invoice_value
         FROM invoices
         WHERE invoice_date BETWEEN ? AND ?
           AND payment_status = 'paid'`,
        [fromDate, toDate],
      );

      // Monthly profit vs expenses data for chart
      const monthlyFinancials = await db.query(
        `SELECT 
          DATE_FORMAT(i.invoice_date, '%b') as month,
          MONTH(i.invoice_date) as month_num,
          COALESCE(SUM(i.total_amount), 0) as profit,
          COALESCE(SUM(e.amount), 0) as expenses
         FROM invoices i
         LEFT JOIN expenses e ON MONTH(i.invoice_date) = MONTH(e.expense_date) 
          AND YEAR(i.invoice_date) = YEAR(e.expense_date)
         WHERE i.invoice_date BETWEEN ? AND ?
           AND i.payment_status = 'paid'
         GROUP BY DATE_FORMAT(i.invoice_date, '%b'), MONTH(i.invoice_date)
         ORDER BY month_num ASC`,
        [fromDate, toDate],
      );

      // Expenses summary
      const expenses = await db.query(
        `SELECT 
          COUNT(*) as total_expenses,
          COALESCE(SUM(totalAmount), 0) as total_expense_amount,
          category,
          COALESCE(SUM(totalAmount), 0) as category_amount,
          COUNT(*) as category_count
         FROM expenses
         WHERE expense_date BETWEEN ? AND ?
         GROUP BY category
         ORDER BY category_amount DESC`,
        [fromDate, toDate],
      );

      // Outstanding payments
      const outstanding = await db.query(
        `SELECT 
          COUNT(*) as total_outstanding_invoices,
          COALESCE(SUM(balance_amount), 0) as total_outstanding_amount
         FROM invoices
         WHERE payment_status IN ('unpaid', 'partial')
           AND invoice_date <= ?`,
        [toDate],
      );

      // Yearly sales trend data
      const yearlySalesTrend = await db.query(
        `SELECT 
          DATE_FORMAT(invoice_date, '%b') as month,
          MONTH(invoice_date) as month_num,
          COALESCE(SUM(total_amount), 0) as sales
         FROM invoices
         WHERE invoice_date BETWEEN ? AND ?
           AND payment_status = 'paid'
         GROUP BY DATE_FORMAT(invoice_date, '%b'), MONTH(invoice_date)
         ORDER BY month_num ASC`,
        [fromDate, toDate],
      );

      const totalExpenses = expenses.reduce(
        (sum, e) => sum + parseFloat(e.total_expense_amount || 0),
        0,
      );
      const totalSales = parseFloat(sales[0]?.total_sales || 0);

      return {
        sales: sales[0] || {
          total_invoices: 0,
          total_sales: 0,
          total_gst: 0,
          avg_invoice_value: 0,
        },
        expenses: expenses,
        outstanding: outstanding[0] || {
          total_outstanding_invoices: 0,
          total_outstanding_amount: 0,
        },
        financial_data: monthlyFinancials,
        sales_trend: yearlySalesTrend,
        profit_loss: {
          total_revenue: totalSales,
          total_expenses: totalExpenses,
          net_profit: totalSales - totalExpenses,
          profit_margin:
            totalSales > 0
              ? (((totalSales - totalExpenses) / totalSales) * 100).toFixed(2)
              : 0,
        },
      };
    } catch (error) {
      console.error("Get financial report error:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  async getCustomerReport(tenantId, customerId, fromDate, toDate) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      const customerDetails = await db.query(
        `SELECT id, name, email, mobile, address, gst_number, status
         FROM customers 
         WHERE id = ?`,
        [parseInt(customerId)],
      );

      if (!customerDetails || customerDetails.length === 0) {
        return {
          customer: null,
          summary: {
            total_invoices: 0,
            total_purchases: 0,
            total_gst: 0,
            avg_invoice_value: 0,
            outstanding_amount: 0,
          },
          invoices: [],
        };
      }

      const customer = customerDetails[0];

      const invoices = await db.query(
        `SELECT 
          i.id,
          i.invoice_no,
          DATE_FORMAT(i.invoice_date, '%Y-%m-%d') as invoice_date,
          i.total_amount,
          i.gst_amount,
          i.payment_status,
          i.balance_amount
         FROM invoices i
         WHERE i.party_type = 'customer'
           AND i.party_id = ?
           AND DATE(i.invoice_date) BETWEEN ? AND ?
         ORDER BY i.invoice_date DESC`,
        [parseInt(customerId), fromDate, toDate],
      );

      const totalPurchases = invoices.reduce(
        (sum, inv) => sum + (parseFloat(inv.total_amount) || 0),
        0,
      );
      const totalGST = invoices.reduce(
        (sum, inv) => sum + (parseFloat(inv.gst_amount) || 0),
        0,
      );
      const outstandingAmount = invoices.reduce(
        (sum, inv) => sum + (parseFloat(inv.balance_amount) || 0),
        0,
      );

      const summary = {
        total_invoices: invoices.length,
        total_purchases: totalPurchases,
        total_gst: totalGST,
        avg_invoice_value:
          invoices.length > 0 ? totalPurchases / invoices.length : 0,
        outstanding_amount: outstandingAmount,
      };

      return {
        customer: customer,
        summary: summary,
        invoices: invoices,
      };
    } catch (error) {
      console.error("Get customer report error:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  async getDashboardSummary(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      const today = moment().format("YYYY-MM-DD");
      const startOfMonth = moment().startOf("month").format("YYYY-MM-DD");
      const startOfYear = moment().startOf("year").format("YYYY-MM-DD");

      const todayStats = await db.query(
        `SELECT 
          COUNT(*) as total_invoices,
          COALESCE(SUM(total_amount), 0) as total_sales,
          COALESCE(SUM(gst_amount), 0) as total_gst
         FROM invoices
         WHERE invoice_date = ?`,
        [today],
      );

      const monthlyStats = await db.query(
        `SELECT 
          COUNT(*) as total_invoices,
          COALESCE(SUM(total_amount), 0) as total_sales,
          COUNT(DISTINCT party_id) as unique_customers
         FROM invoices
         WHERE invoice_date >= ?`,
        [startOfMonth],
      );

      const yearlySales = await db.query(
        `SELECT 
          DATE_FORMAT(invoice_date, '%b') as month,
          MONTH(invoice_date) as month_num,
          COALESCE(SUM(total_amount), 0) as sales
         FROM invoices
         WHERE invoice_date >= ?
           AND payment_status = 'paid'
         GROUP BY DATE_FORMAT(invoice_date, '%b'), MONTH(invoice_date)
         ORDER BY month_num ASC`,
        [startOfYear],
      );

      const profitExpenseData = await db.query(
        `SELECT 
          DATE_FORMAT(i.invoice_date, '%b') as month,
          MONTH(i.invoice_date) as month_num,
          COALESCE(SUM(i.total_amount), 0) as profit,
          COALESCE(SUM(e.amount), 0) as expenses
         FROM invoices i
         LEFT JOIN expenses e ON MONTH(i.invoice_date) = MONTH(e.expense_date) 
          AND YEAR(i.invoice_date) = YEAR(e.expense_date)
         WHERE i.invoice_date >= DATE_SUB(?, INTERVAL 6 MONTH)
           AND i.payment_status = 'paid'
         GROUP BY DATE_FORMAT(i.invoice_date, '%b'), MONTH(i.invoice_date)
         ORDER BY month_num ASC`,
        [today],
      );

      const lowStock = await db.query(
        `SELECT ct.name as cylinder_name, ct.weight, gs.available_stock, gs.reorder_level
         FROM gas_stocks gs
         LEFT JOIN cylinder_types ct ON gs.cylinder_type_id = ct.id
         WHERE gs.available_stock <= gs.reorder_level
         LIMIT 5`,
      );

      const summaryCards = await db.query(
        `SELECT 
          (SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE payment_status = 'paid' AND invoice_date >= ?) as total_sales,
          (SELECT COALESCE(SUM(gst_amount), 0) FROM invoices WHERE payment_status = 'paid' AND invoice_date >= ?) as gst_collected,
          (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE expense_date >= ?) as total_expenses,
          ((SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE payment_status = 'paid' AND invoice_date >= ?) - 
           (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE expense_date >= ?)) as net_profit`,
        [startOfMonth, startOfMonth, startOfMonth, startOfMonth, startOfMonth],
      );

      return {
        summary_cards: {
          total_sales: parseFloat(summaryCards[0]?.total_sales || 0),
          gst_collected: parseFloat(summaryCards[0]?.gst_collected || 0),
          total_expenses: parseFloat(summaryCards[0]?.total_expenses || 0),
          net_profit: parseFloat(summaryCards[0]?.net_profit || 0),
        },
        today: {
          invoices: parseInt(todayStats[0]?.total_invoices) || 0,
          sales: parseFloat(todayStats[0]?.total_sales) || 0,
          gst: parseFloat(todayStats[0]?.total_gst) || 0,
        },
        monthly: {
          invoices: parseInt(monthlyStats[0]?.total_invoices) || 0,
          sales: parseFloat(monthlyStats[0]?.total_sales) || 0,
          customers: parseInt(monthlyStats[0]?.unique_customers) || 0,
        },
        yearly_sales: yearlySales,
        profit_expense_data: profitExpenseData,
        low_stock_count: lowStock.length,
        low_stock_items: lowStock,
      };
    } catch (error) {
      console.error("Get dashboard summary error:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  // ==================== EXPORT METHODS ====================
  // Export Sales Report as PDF (Professional Fixed Design - Using Rs. instead of ₹)
  async exportSalesReportPDF(tenantId, fromDate, toDate) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      // Fetch detailed sales data
      const query = `
      SELECT 
        DATE_FORMAT(i.invoice_date, '%d-%m-%Y') as date,
        i.invoice_no,
        CASE 
          WHEN i.party_type = 'customer' THEN c.name
          WHEN i.party_type = 'dealer' THEN d.name
          ELSE 'Unknown'
        END as party_name,
        i.total_amount,
        i.gst_amount,
        i.payment_status
      FROM invoices i
      LEFT JOIN customers c ON i.party_type = 'customer' AND i.party_id = c.id
      LEFT JOIN dealers d ON i.party_type = 'dealer' AND i.party_id = d.id
      WHERE i.invoice_date BETWEEN ? AND ?
        AND i.payment_status = 'paid'
      ORDER BY i.invoice_date DESC
    `;

      let sales = await db.query(query, [fromDate, toDate]);

      if (
        Array.isArray(sales) &&
        sales.length > 0 &&
        sales[0] &&
        Array.isArray(sales[0])
      ) {
        sales = sales[0];
      }

      // Fetch summary
      const summaryQuery = `
      SELECT 
        COALESCE(SUM(total_amount), 0) as total_sales,
        COALESCE(SUM(gst_amount), 0) as total_gst,
        COUNT(*) as total_invoices,
        COALESCE(AVG(total_amount), 0) as avg_invoice_value
      FROM invoices
      WHERE invoice_date BETWEEN ? AND ?
        AND payment_status = 'paid'
    `;

      let summary = await db.query(summaryQuery, [fromDate, toDate]);

      if (
        Array.isArray(summary) &&
        summary.length > 0 &&
        summary[0] &&
        Array.isArray(summary[0])
      ) {
        summary = summary[0];
      }

      const totals =
        summary && summary[0]
          ? summary[0]
          : {
              total_sales: 0,
              total_gst: 0,
              total_invoices: 0,
              avg_invoice_value: 0,
            };

      const totalSales = parseFloat(totals.total_sales) || 0;
      const totalGST = parseFloat(totals.total_gst) || 0;
      const totalInvoices = parseInt(totals.total_invoices) || 0;
      const avgInvoice = parseFloat(totals.avg_invoice_value) || 0;

      // Use Rs. instead of ₹ symbol
      const currencySymbol = "Rs.";

      const chunks = [];

      return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
          margin: 50,
          size: "A4",
          layout: "portrait",
        });

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => {
          const buffer = Buffer.concat(chunks);
          resolve(buffer);
        });
        doc.on("error", reject);

        try {
          // ==================== HEADER SECTION ====================
          let currentY = 50;

          // Title
          doc
            .fontSize(24)
            .font("Helvetica-Bold")
            .fillColor("#1a4d8c")
            .text("SALES REPORT", { align: "center" });

          currentY = doc.y + 10;

          doc
            .fontSize(12)
            .font("Helvetica")
            .fillColor("#666666")
            .text(`Period: ${fromDate} to ${toDate}`, { align: "center" });

          doc.text(`Generated: ${new Date().toLocaleString()}`, {
            align: "center",
          });

          currentY = doc.y + 20;

          // Add divider line
          currentY = doc.y + 15; // Space after header text

          // Divider line
          doc
            .strokeColor("#1a4d8c")
            .lineWidth(2)
            .moveTo(50, currentY)
            .lineTo(545, currentY)
            .stroke();

          // ==================== SUMMARY CARDS ====================
          currentY = doc.y + 20; // Space after divider line

          // Summary title
          doc
            .fontSize(14)
            .font("Helvetica-Bold")
            .fillColor("#1a4d8c")
            .text("SUMMARY", 50, currentY);

          currentY = doc.y + 15; // Space after summary title before cards

          // Create summary table
          const summaryTableTop = currentY;
          const colWidth = 110;
          const startX = 50;

          // Draw summary cards (using Rs. instead of ₹)
          const summaryData = [
            { label: "Total Invoices", value: totalInvoices, color: "#4CAF50" },
            {
              label: "Total Sales",
              value: `${currencySymbol} ${totalSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
              color: "#2196F3",
            },
            {
              label: "Total GST",
              value: `${currencySymbol} ${totalGST.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
              color: "#FF9800",
            },
            {
              label: "Average Invoice",
              value: `${currencySymbol} ${avgInvoice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
              color: "#9C27B0",
            },
          ];

          summaryData.forEach((item, index) => {
            const x = startX + index * colWidth;

            // Card background
            doc
              .fillColor("#f5f5f5")
              .rect(x, summaryTableTop, colWidth - 5, 50)
              .fill();

            // Border
            doc
              .strokeColor("#e0e0e0")
              .lineWidth(0.5)
              .rect(x, summaryTableTop, colWidth - 5, 50)
              .stroke();

            // Label
            doc
              .fontSize(9)
              .font("Helvetica")
              .fillColor("#666666")
              .text(item.label, x + 10, summaryTableTop + 10);

            // Value
            doc
              .fontSize(14)
              .font("Helvetica-Bold")
              .fillColor(item.color)
              .text(item.value.toString(), x + 10, summaryTableTop + 28);
          });

          currentY = summaryTableTop + 70;

          // ==================== SALES DETAILS TABLE ====================
          doc
            .fontSize(14)
            .font("Helvetica-Bold")
            .fillColor("#1a4d8c")
            .text("SALES DETAILS", 50, currentY);

          currentY = doc.y + 15;

          // Table headers (using Rs. instead of ₹)
          const headers = [
            "Date",
            "Invoice No",
            "Customer Name",
            `Amount (${currencySymbol})`,
            `GST (${currencySymbol})`,
            "Status",
          ];
          const colPositions = [50, 120, 200, 340, 420, 480];

          // Header background
          doc.fillColor("#1a4d8c").rect(50, currentY, 495, 25).fill();

          // Header text
          doc.fillColor("#ffffff").fontSize(10).font("Helvetica-Bold");

          headers.forEach((header, index) => {
            doc.text(header, colPositions[index] + 5, currentY + 8);
          });

          currentY += 25;

          // Draw horizontal line under header
          doc
            .strokeColor("#1a4d8c")
            .lineWidth(1)
            .moveTo(50, currentY)
            .lineTo(545, currentY)
            .stroke();

          // Table rows
          let rowCount = 0;
          const totalAmount = sales.reduce(
            (sum, sale) => sum + (parseFloat(sale.total_amount) || 0),
            0,
          );
          const totalGSTAmount = sales.reduce(
            (sum, sale) => sum + (parseFloat(sale.gst_amount) || 0),
            0,
          );

          if (sales && sales.length > 0) {
            for (const sale of sales) {
              // Check for page break
              if (currentY > 700) {
                doc.addPage();
                currentY = 50;

                // Redraw headers on new page
                doc.fillColor("#1a4d8c").rect(50, currentY, 495, 25).fill();
                doc.fillColor("#ffffff").fontSize(10).font("Helvetica-Bold");
                headers.forEach((header, index) => {
                  doc.text(header, colPositions[index] + 5, currentY + 8);
                });
                currentY += 25;
              }

              // Alternate row colors
              if (rowCount % 2 === 0) {
                doc.fillColor("#f9f9f9").rect(50, currentY, 495, 22).fill();
              }

              doc.fillColor("#333333").fontSize(9).font("Helvetica");

              const date = sale.date || "";
              const invoiceNo = sale.invoice_no || "N/A";
              const customerName = (sale.party_name || "Unknown").substring(
                0,
                30,
              );
              const amount = parseFloat(sale.total_amount) || 0;
              const gst = parseFloat(sale.gst_amount) || 0;
              const status = (sale.payment_status || "Paid").toUpperCase();

              doc.text(date, colPositions[0] + 5, currentY + 6);
              doc.text(invoiceNo, colPositions[1] + 5, currentY + 6);
              doc.text(customerName, colPositions[2] + 5, currentY + 6);
              doc.text(
                amount.toLocaleString("en-IN", { minimumFractionDigits: 2 }),
                colPositions[3] + 5,
                currentY + 6,
              );
              doc.text(
                gst.toLocaleString("en-IN", { minimumFractionDigits: 2 }),
                colPositions[4] + 5,
                currentY + 6,
              );

              // Status with color
              const statusColor =
                status === "PAID"
                  ? "#4CAF50"
                  : status === "PENDING"
                    ? "#FF9800"
                    : "#f44336";
              doc
                .fillColor(statusColor)
                .fontSize(8)
                .font("Helvetica-Bold")
                .text(status, colPositions[5] + 5, currentY + 7);

              doc.fillColor("#333333");

              currentY += 22;
              rowCount++;
            }

            // Draw footer line
            doc
              .strokeColor("#dddddd")
              .lineWidth(1)
              .moveTo(50, currentY)
              .lineTo(545, currentY)
              .stroke();

            currentY += 10;

            // Total row (using Rs. instead of ₹)
            doc.fillColor("#e8f0fe").rect(50, currentY, 495, 25).fill();

            doc
              .fontSize(10)
              .font("Helvetica-Bold")
              .fillColor("#1a4d8c")
              .text("GRAND TOTAL", 250, currentY + 8);

            doc
              .fillColor("#2196F3")
              .text(
                `${currencySymbol} ${totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
                colPositions[3] + 5,
                currentY + 8,
              );

            doc
              .fillColor("#FF9800")
              .text(
                `${currencySymbol} ${totalGSTAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
                colPositions[4] + 5,
                currentY + 8,
              );

            currentY += 35;
          } else {
            doc
              .fillColor("#999999")
              .fontSize(11)
              .text(
                "No sales records found for the selected period.",
                50,
                currentY + 10,
                { align: "center" },
              );
            currentY += 40;
          }

          // ==================== FOOTER ====================
          const footerY = 750;

          // Divider line
          doc
            .strokeColor("#cccccc")
            .lineWidth(0.5)
            .moveTo(50, footerY - 30)
            .lineTo(545, footerY - 30)
            .stroke();

          // Footer text
          doc
            .fillColor("#999999")
            .fontSize(8)
            .font("Helvetica")
            .text("GasFlow ERP System", 50, footerY - 22);

          doc.text(`Page ${doc.page}`, 520, footerY - 22, { align: "right" });
          doc.text(
            `Generated: ${new Date().toLocaleString()}`,
            520,
            footerY - 14,
            { align: "right" },
          );

          doc.end();
        } catch (err) {
          console.error("Error generating PDF content:", err);
          reject(err);
        }
      });
    } catch (error) {
      console.error("Export sales report PDF error:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  // Export Sales Report as CSV (Fixed Encoding - No Special Characters)
  async exportSalesReportCSV(tenantId, fromDate, toDate) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      const query = `
      SELECT 
        DATE_FORMAT(i.invoice_date, '%d-%m-%Y') as date,
        i.invoice_no,
        CASE 
          WHEN i.party_type = 'customer' THEN c.name
          WHEN i.party_type = 'dealer' THEN d.name
          ELSE 'Unknown'
        END as customer_name,
        i.total_amount,
        i.gst_amount,
        i.payment_status
      FROM invoices i
      LEFT JOIN customers c ON i.party_type = 'customer' AND i.party_id = c.id
      LEFT JOIN dealers d ON i.party_type = 'dealer' AND i.party_id = d.id
      WHERE i.invoice_date BETWEEN ? AND ?
        AND i.payment_status = 'paid'
      ORDER BY i.invoice_date DESC
    `;

      let sales = await db.query(query, [fromDate, toDate]);

      if (
        Array.isArray(sales) &&
        sales.length > 0 &&
        sales[0] &&
        Array.isArray(sales[0])
      ) {
        sales = sales[0];
      }

      // Fetch company settings
      let companyName = "GasFlow ERP";

      try {
        const companyQuery = `SELECT * FROM company_settings WHERE tenant_id = ? LIMIT 1`;
        const companySettings = await db.query(companyQuery, [tenantId]);
        if (companySettings && companySettings.length > 0) {
          const settings = companySettings[0];
          companyName = settings.company_name || "GasFlow ERP";
        }
      } catch (err) {
        console.warn("Could not fetch company settings:", err.message);
      }

      const totalAmount = sales.reduce(
        (sum, sale) => sum + (parseFloat(sale.total_amount) || 0),
        0,
      );
      const totalGST = sales.reduce(
        (sum, sale) => sum + (parseFloat(sale.gst_amount) || 0),
        0,
      );
      const totalWithGST = totalAmount + totalGST;

      // Use 'Rs.' instead of Rupee symbol to avoid encoding issues
      const currencySymbol = "Rs.";

      const rows = [];

      // Add UTF-8 BOM for Excel compatibility
      rows.push("\uFEFF");

      // ==================== HEADER SECTION ====================
      rows.push(`"${companyName.toUpperCase()}"`);
      rows.push('"SALES REPORT"');
      rows.push("");

      // Report Information
      rows.push('"REPORT INFORMATION"');
      rows.push(`"Period","${fromDate} to ${toDate}"`);
      rows.push(`"Generated On","${new Date().toLocaleString()}"`);
      rows.push('"Status","Paid Invoices Only"');
      rows.push("");

      // ==================== SUMMARY SECTION ====================
      rows.push('"SUMMARY"');
      rows.push('"Metric","Value"');
      rows.push(`"Total Invoices",${sales.length}`);
      rows.push(
        `"Total Sales (excl GST)","${currencySymbol} ${totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}"`,
      );
      rows.push(
        `"Total GST","${currencySymbol} ${totalGST.toLocaleString("en-IN", { minimumFractionDigits: 2 })}"`,
      );
      rows.push(
        `"Total Amount (incl GST)","${currencySymbol} ${totalWithGST.toLocaleString("en-IN", { minimumFractionDigits: 2 })}"`,
      );
      rows.push(
        `"Average Invoice Value","${currencySymbol} ${sales.length > 0 ? (totalAmount / sales.length).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0"}"`,
      );
      rows.push("");

      // ==================== SALES DETAILS SECTION ====================
      rows.push('"SALES DETAILS"');
      rows.push("");

      // Table Headers
      rows.push(
        [
          '"S.No"',
          '"Date"',
          '"Invoice No"',
          '"Customer Name"',
          `"Amount (${currencySymbol})"`,
          `"GST (${currencySymbol})"`,
          `"Total (${currencySymbol})"`,
          '"Status"',
        ].join(","),
      );

      // Table Data
      if (sales && sales.length > 0) {
        sales.forEach((sale, index) => {
          const amount = parseFloat(sale.total_amount) || 0;
          const gst = parseFloat(sale.gst_amount) || 0;
          const total = amount + gst;

          rows.push(
            [
              `"${index + 1}"`,
              `"${sale.date || ""}"`,
              `"${sale.invoice_no || "N/A"}"`,
              `"${(sale.customer_name || "Unknown").replace(/"/g, '""')}"`,
              `${amount.toFixed(2)}`,
              `${gst.toFixed(2)}`,
              `${total.toFixed(2)}`,
              `"${(sale.payment_status || "Paid").toUpperCase()}"`,
            ].join(","),
          );
        });

        // Grand Total Row
        rows.push("");
        rows.push(
          [
            '""',
            '""',
            '""',
            '"GRAND TOTAL"',
            totalAmount.toFixed(2),
            totalGST.toFixed(2),
            totalWithGST.toFixed(2),
            '""',
          ].join(","),
        );
      } else {
        rows.push('"No sales records found for the selected period"');
      }

      rows.push("");

      // ==================== FOOTER SECTION ====================
      rows.push('"*** END OF REPORT ***"');
      rows.push(
        `"Generated by ${companyName} ERP System on ${new Date().toLocaleString()}"`,
      );

      return rows.join("\n");
    } catch (error) {
      console.error("Export sales report CSV error:", error);
      throw error;
    } finally {
      await db.end();
    }
  }
  // Export Sales Report as Excel (XLSX)
  async exportSalesReportXLSX(tenantId, fromDate, toDate) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    const ExcelJS = require("exceljs");

    try {
      const query = `
        SELECT 
          DATE_FORMAT(i.invoice_date, '%Y-%m-%d') as date,
          i.invoice_no,
          CASE 
            WHEN i.party_type = 'customer' THEN c.name
            WHEN i.party_type = 'dealer' THEN d.name
            ELSE 'Unknown'
          END as customer_name,
          i.total_amount,
          i.gst_amount,
          i.payment_status
        FROM invoices i
        LEFT JOIN customers c ON i.party_type = 'customer' AND i.party_id = c.id
        LEFT JOIN dealers d ON i.party_type = 'dealer' AND i.party_id = d.id
        WHERE i.invoice_date BETWEEN ? AND ?
          AND i.payment_status = 'paid'
        ORDER BY i.invoice_date DESC
      `;

      const sales = await db.query(query, [fromDate, toDate]);

      const summaryQuery = `
        SELECT 
          COALESCE(SUM(total_amount), 0) as total_sales,
          COALESCE(SUM(gst_amount), 0) as total_gst,
          COUNT(*) as total_invoices
        FROM invoices
        WHERE invoice_date BETWEEN ? AND ?
          AND payment_status = 'paid'
      `;

      const summary = await db.query(summaryQuery, [fromDate, toDate]);
      const totals = summary[0] || {
        total_sales: 0,
        total_gst: 0,
        total_invoices: 0,
      };

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Sales Report");

      worksheet.mergeCells("A1:F1");
      worksheet.getCell("A1").value = "Sales Report";
      worksheet.getCell("A1").font = { size: 16, bold: true };
      worksheet.getCell("A1").alignment = { horizontal: "center" };

      worksheet.mergeCells("A2:F2");
      worksheet.getCell("A2").value = `Period: ${fromDate} to ${toDate}`;
      worksheet.getCell("A2").alignment = { horizontal: "center" };

      worksheet.addRow([]);
      worksheet.addRow(["Summary"]);
      worksheet.getCell(`A${worksheet.rowCount}`).font = {
        bold: true,
        size: 12,
      };
      worksheet.addRow(["Total Invoices", totals.total_invoices]);
      worksheet.addRow(["Total Sales", totals.total_sales]);
      worksheet.addRow(["Total GST", totals.total_gst]);
      worksheet.addRow([]);

      const headers = [
        "Date",
        "Invoice No",
        "Customer Name",
        "Amount (₹)",
        "GST (₹)",
        "Status",
      ];
      const headerRow = worksheet.addRow(headers);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };

      for (const sale of sales) {
        worksheet.addRow([
          sale.date,
          sale.invoice_no,
          sale.customer_name || "Unknown",
          Number(sale.total_amount || 0),
          Number(sale.gst_amount || 0),
          sale.payment_status,
        ]);
      }

      worksheet.columns.forEach((column) => {
        column.width = 15;
      });

      return workbook;
    } catch (error) {
      console.error("Export sales report XLSX error:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  // Export Expenses Report as PDF (Buffer approach)
  async exportExpensesReportPDF(tenantId, fromDate, toDate) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      const expenses = await db.query(
        `SELECT 
          expense_date,
          category,
          description,
          amount,
          taxAmount,
          totalAmount
         FROM expenses
         WHERE expense_date BETWEEN ? AND ?
         ORDER BY expense_date DESC`,
        [fromDate, toDate],
      );

      const categoryTotals = {};
      let totalExpenses = 0;

      for (const expense of expenses) {
        const amount = parseFloat(expense.totalAmount || expense.amount || 0);
        totalExpenses += amount;

        if (categoryTotals[expense.category]) {
          categoryTotals[expense.category] += amount;
        } else {
          categoryTotals[expense.category] = amount;
        }
      }

      const chunks = [];

      return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        doc.fontSize(20).text("Expenses Report", { align: "center" });
        doc.moveDown();
        doc
          .fontSize(12)
          .text(`Period: ${fromDate} to ${toDate}`, { align: "center" });
        doc.moveDown();

        doc.fontSize(14).text("Summary", { underline: true });
        doc.fontSize(12);
        doc.text(`Total Expenses: ${expenses.length}`);
        doc.text(`Total Amount: ₹${totalExpenses.toLocaleString("en-IN")}`);
        doc.moveDown();

        doc.fontSize(14).text("Category Breakdown", { underline: true });
        doc.fontSize(12);

        for (const [category, amount] of Object.entries(categoryTotals)) {
          const percentage =
            totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(2) : 0;
          doc.text(
            `${category}: ₹${amount.toLocaleString("en-IN")} (${percentage}%)`,
          );
        }
        doc.moveDown();

        if (expenses.length > 0) {
          const startX = 50;
          let startY = doc.y;

          doc.fontSize(10);
          doc.text("Date", startX, startY);
          doc.text("Category", startX + 100, startY);
          doc.text("Description", startX + 180, startY);
          doc.text("Amount", startX + 330, startY);
          doc.text("Tax", startX + 420, startY);

          startY += 20;
          doc
            .moveTo(startX, startY)
            .lineTo(startX + 500, startY)
            .stroke();
          startY += 10;

          for (const expense of expenses) {
            if (startY > 700) {
              doc.addPage();
              startY = 50;
              doc.fontSize(10);
              doc.text("Date", startX, startY);
              doc.text("Category", startX + 100, startY);
              doc.text("Description", startX + 180, startY);
              doc.text("Amount", startX + 330, startY);
              doc.text("Tax", startX + 420, startY);
              startY += 20;
              doc
                .moveTo(startX, startY)
                .lineTo(startX + 500, startY)
                .stroke();
              startY += 10;
            }

            const date = expense.expense_date
              ? new Date(expense.expense_date).toLocaleDateString("en-IN")
              : "";
            const amount = parseFloat(
              expense.totalAmount || expense.amount || 0,
            );
            const taxAmount = parseFloat(expense.taxAmount || 0);

            doc.text(date, startX, startY);
            doc.text(expense.category || "", startX + 100, startY);
            doc.text(
              (expense.description || "").substring(0, 35),
              startX + 180,
              startY,
            );
            doc.text(
              `₹${amount.toLocaleString("en-IN")}`,
              startX + 330,
              startY,
            );
            doc.text(
              `₹${taxAmount.toLocaleString("en-IN")}`,
              startX + 420,
              startY,
            );

            startY += 20;
          }
        }

        doc.end();
      });
    } catch (error) {
      console.error("Export expenses report PDF error:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  // Export Financial Report as PDF (Buffer approach)
  async exportFinancialReportPDF(tenantId, fromDate, toDate) {
    const financialData = await this.getFinancialReport(
      tenantId,
      fromDate,
      toDate,
    );

    const chunks = [];

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(20).text("Financial Report", { align: "center" });
      doc.moveDown();
      doc
        .fontSize(12)
        .text(`Period: ${fromDate} to ${toDate}`, { align: "center" });
      doc.moveDown();

      doc.fontSize(16).text("Profit & Loss Statement", { align: "center" });
      doc.moveDown();

      doc.fontSize(12);
      doc.text("Income:", { underline: true });
      doc.text(
        `Total Sales: ₹${financialData.profit_loss.total_revenue.toLocaleString("en-IN")}`,
      );
      doc.moveDown();

      doc.text("Expenses:", { underline: true });
      doc.text(
        `Total Expenses: ₹${financialData.profit_loss.total_expenses.toLocaleString("en-IN")}`,
      );
      doc.moveDown();

      doc.text("Net Profit:", { underline: true });
      doc.fontSize(14);
      doc.text(
        `₹${financialData.profit_loss.net_profit.toLocaleString("en-IN")}`,
        { color: "green" },
      );
      doc.fontSize(12);
      doc.text(`Profit Margin: ${financialData.profit_loss.profit_margin}%`);
      doc.moveDown();

      if (financialData.expenses && financialData.expenses.length > 0) {
        doc.fontSize(14).text("Expense Breakdown", { underline: true });
        doc.fontSize(12);

        const startX = 50;
        let startY = doc.y;

        doc.text("Category", startX, startY);
        doc.text("Amount", startX + 200, startY);
        doc.text("Percentage", startX + 300, startY);

        startY += 20;
        doc
          .moveTo(startX, startY)
          .lineTo(startX + 400, startY)
          .stroke();
        startY += 10;

        for (const expense of financialData.expenses) {
          const percentage =
            financialData.profit_loss.total_expenses > 0
              ? (
                  (expense.category_amount /
                    financialData.profit_loss.total_expenses) *
                  100
                ).toFixed(2)
              : 0;

          doc.text(expense.category || "", startX, startY);
          doc.text(
            `₹${expense.category_amount.toLocaleString("en-IN")}`,
            startX + 200,
            startY,
          );
          doc.text(`${percentage}%`, startX + 300, startY);

          startY += 20;
        }
      }

      doc.end();
    });
  }

  // Export Customer Report as PDF (Buffer approach)
  async exportCustomerReportPDF(tenantId, customerId, fromDate, toDate) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      const customerDetails = await db.query(
        `SELECT id, name, email, mobile, address, gst_number, status
         FROM customers 
         WHERE id = ?`,
        [parseInt(customerId)],
      );

      if (!customerDetails || customerDetails.length === 0) {
        throw new Error(`Customer not found with ID: ${customerId}`);
      }

      const customer = customerDetails[0];

      const invoices = await db.query(
        `SELECT 
          i.invoice_no,
          DATE_FORMAT(i.invoice_date, '%Y-%m-%d') as invoice_date,
          i.total_amount,
          i.gst_amount,
          i.payment_status,
          i.balance_amount
         FROM invoices i
         WHERE i.party_type = 'customer'
           AND i.party_id = ?
           AND DATE(i.invoice_date) BETWEEN ? AND ?
         ORDER BY i.invoice_date DESC`,
        [parseInt(customerId), fromDate, toDate],
      );

      const totalPurchases = invoices.reduce(
        (sum, inv) => sum + (parseFloat(inv.total_amount) || 0),
        0,
      );
      const totalGST = invoices.reduce(
        (sum, inv) => sum + (parseFloat(inv.gst_amount) || 0),
        0,
      );
      const outstandingAmount = invoices.reduce(
        (sum, inv) => sum + (parseFloat(inv.balance_amount) || 0),
        0,
      );

      const chunks = [];

      return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        doc.fontSize(20).text("Customer Report", { align: "center" });
        doc.moveDown();
        doc
          .fontSize(12)
          .text(`Period: ${fromDate} to ${toDate}`, { align: "center" });
        doc.moveDown();

        doc.fontSize(14).text("Customer Information", { underline: true });
        doc.fontSize(12);
        doc.text(`Name: ${customer.name || "N/A"}`);
        doc.text(`Email: ${customer.email || "N/A"}`);
        doc.text(`Mobile: ${customer.mobile || "N/A"}`);
        doc.text(`Address: ${customer.address || "N/A"}`);
        doc.text(`GST Number: ${customer.gst_number || "N/A"}`);
        doc.text(`Status: ${customer.status || "Active"}`);
        doc.moveDown();

        doc.fontSize(14).text("Summary", { underline: true });
        doc.fontSize(12);
        doc.text(`Total Invoices: ${invoices.length}`);
        doc.text(`Total Purchases: ₹${totalPurchases.toLocaleString("en-IN")}`);
        doc.text(`Total GST: ₹${totalGST.toLocaleString("en-IN")}`);
        doc.text(
          `Outstanding Amount: ₹${outstandingAmount.toLocaleString("en-IN")}`,
        );
        doc.moveDown();

        if (invoices.length > 0) {
          doc.fontSize(14).text("Invoice Details", { underline: true });

          const startX = 50;
          let startY = doc.y + 10;

          doc.fontSize(10);
          doc.text("Invoice No", startX, startY);
          doc.text("Date", startX + 100, startY);
          doc.text("Amount", startX + 170, startY);
          doc.text("GST", startX + 240, startY);
          doc.text("Status", startX + 310, startY);
          doc.text("Balance", startX + 380, startY);

          startY += 20;
          doc
            .moveTo(startX, startY)
            .lineTo(startX + 450, startY)
            .stroke();
          startY += 10;

          for (const invoice of invoices) {
            if (startY > 700) {
              doc.addPage();
              startY = 50;
              doc.fontSize(10);
              doc.text("Invoice No", startX, startY);
              doc.text("Date", startX + 100, startY);
              doc.text("Amount", startX + 170, startY);
              doc.text("GST", startX + 240, startY);
              doc.text("Status", startX + 310, startY);
              doc.text("Balance", startX + 380, startY);
              startY += 20;
              doc
                .moveTo(startX, startY)
                .lineTo(startX + 450, startY)
                .stroke();
              startY += 10;
            }

            doc.text(invoice.invoice_no || "", startX, startY);
            doc.text(invoice.invoice_date || "", startX + 100, startY);
            doc.text(
              `₹${parseFloat(invoice.total_amount || 0).toLocaleString("en-IN")}`,
              startX + 170,
              startY,
            );
            doc.text(
              `₹${parseFloat(invoice.gst_amount || 0).toLocaleString("en-IN")}`,
              startX + 240,
              startY,
            );
            doc.text(invoice.payment_status || "Pending", startX + 310, startY);
            doc.text(
              `₹${parseFloat(invoice.balance_amount || 0).toLocaleString("en-IN")}`,
              startX + 380,
              startY,
            );

            startY += 20;
          }
        }

        doc.end();
      });
    } catch (error) {
      console.error("Export customer report PDF error:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  // Export Customer Report as CSV
  async exportCustomerReportCSV(tenantId, customerId, fromDate, toDate) {
    const customerData = await this.getCustomerReport(
      tenantId,
      customerId,
      fromDate,
      toDate,
    );

    if (!customerData.customer) {
      throw new Error(`Customer not found with ID: ${customerId}`);
    }

    const customer = customerData.customer;

    let csv = "Customer Report\n\n";
    csv += `Customer Name,${customer.name || "N/A"}\n`;
    csv += `Email,${customer.email || "N/A"}\n`;
    csv += `Mobile,${customer.mobile || "N/A"}\n`;
    csv += `Address,${customer.address || "N/A"}\n`;
    csv += `GST Number,${customer.gst_number || "N/A"}\n`;
    csv += `Period,${fromDate} to ${toDate}\n\n`;

    csv += "Summary\n";
    csv += `Total Invoices,${customerData.summary.total_invoices}\n`;
    csv += `Total Purchases,${customerData.summary.total_purchases}\n`;
    csv += `Total GST,${customerData.summary.total_gst}\n`;
    csv += `Outstanding Amount,${customerData.summary.outstanding_amount}\n\n`;

    csv += "Invoice Details\n";
    csv += "Invoice No,Date,Amount,GST,Status,Balance\n";

    for (const inv of customerData.invoices) {
      csv += `${inv.invoice_no},`;
      csv += `${inv.invoice_date},`;
      csv += `${inv.total_amount},`;
      csv += `${inv.gst_amount},`;
      csv += `${inv.payment_status},`;
      csv += `${inv.balance_amount}\n`;
    }

    return csv;
  }
}

module.exports = new ReportService();
