const DatabaseManager = require("../../services/database-manager.service");
const moment = require("moment");
const PDFDocument = require("pdfkit");

class ReportService {
  async getSalesReport(tenantId, fromDate, toDate) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      // Get monthly sales data for the year - FIXED GROUP BY
      const query = `
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

      const sales = await db.query(query, [fromDate, toDate]);

      // Get daily sales for current month
      const dailyQuery = `
        SELECT 
          DATE(i.invoice_date) as date,
          DAY(i.invoice_date) as day,
          COALESCE(SUM(i.total_amount), 0) as daily_sales,
          COUNT(*) as invoice_count
        FROM invoices i
        WHERE i.invoice_date BETWEEN ? AND ?
          AND i.payment_status = 'paid'
        GROUP BY DATE(i.invoice_date)
        ORDER BY date ASC
      `;

      const dailySales = await db.query(dailyQuery, [fromDate, toDate]);

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

      const summary = await db.query(summaryQuery, [fromDate, toDate]);

      return {
        summary: summary[0] || {
          total_sales: 0,
          total_gst: 0,
          total_invoices: 0,
          avg_invoice_value: 0,
          unique_customers: 0,
        },
        monthly_data: sales,
        daily_data: dailySales,
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

      // Monthly profit vs expenses data for chart - FIXED GROUP BY
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
      // In getFinancialReport method, update the expenses query
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

      // Yearly sales trend data - FIXED GROUP BY
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

  // FIXED: Changed 'phone' to 'mobile'
  // Get Customer Report with detailed logging
  // Get Customer Report - Fixed version
  async getCustomerReport(tenantId, customerId, fromDate, toDate) {
    console.log("=== getCustomerReport called ===");
    console.log("Looking for customer ID:", customerId);

    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      // First, check if customer exists
      const customerDetails = await db.query(
        `SELECT id, name, email, mobile, address, gst_number, status
       FROM customers 
       WHERE id = ?`,
        [parseInt(customerId)], // Make sure it's an integer
      );

      console.log(
        "Customer query result:",
        JSON.stringify(customerDetails, null, 2),
      );

      if (!customerDetails || customerDetails.length === 0) {
        console.log("No customer found with ID:", customerId);
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
      console.log("Customer found:", customer.name);

      // Get customer invoices
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

      console.log("Invoices found:", invoices.length);

      // Calculate summary
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

      console.log("Summary calculated:", summary);

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

      // Today's statistics
      const todayStats = await db.query(
        `SELECT 
          COUNT(*) as total_invoices,
          COALESCE(SUM(total_amount), 0) as total_sales,
          COALESCE(SUM(gst_amount), 0) as total_gst
         FROM invoices
         WHERE invoice_date = ?`,
        [today],
      );

      // Monthly statistics
      const monthlyStats = await db.query(
        `SELECT 
          COUNT(*) as total_invoices,
          COALESCE(SUM(total_amount), 0) as total_sales,
          COUNT(DISTINCT party_id) as unique_customers
         FROM invoices
         WHERE invoice_date >= ?`,
        [startOfMonth],
      );

      // Yearly sales trend - FIXED GROUP BY
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

      // Profit vs expenses for last 6 months - FIXED GROUP BY
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

      // Low stock items
      const lowStock = await db.query(
        `SELECT ct.name as cylinder_name, ct.weight, gs.available_stock, gs.reorder_level
         FROM gas_stocks gs
         LEFT JOIN cylinder_types ct ON gs.cylinder_type_id = ct.id
         WHERE gs.available_stock <= gs.reorder_level
         LIMIT 5`,
      );

      // Summary cards data
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

  // Export report methods
  async exportSalesReport(tenantId, fromDate, toDate, format) {
    const data = await this.getSalesReport(tenantId, fromDate, toDate);
    return data;
  }

  async exportStockReport(tenantId, format) {
    const data = await this.getStockReport(tenantId);
    return data;
  }

  async exportFinancialReport(tenantId, fromDate, toDate, format) {
    const data = await this.getFinancialReport(tenantId, fromDate, toDate);
    return data;
  }

  async exportCustomerReport(tenantId, customerId, fromDate, toDate, format) {
    const data = await this.getCustomerReport(
      tenantId,
      customerId,
      fromDate,
      toDate,
    );
    return data;
  }

  // Export Sales Report as PDF
  async exportSalesReportPDF(tenantId, fromDate, toDate) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      // Fetch data
      const query = `
        SELECT 
          DATE_FORMAT(i.invoice_date, '%Y-%m-%d') as date,
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

      const sales = await db.query(query, [fromDate, toDate]);

      // Calculate totals
      const totalSales = sales.reduce(
        (sum, s) => sum + (parseFloat(s.total_amount) || 0),
        0,
      );
      const totalGST = sales.reduce(
        (sum, s) => sum + (parseFloat(s.gst_amount) || 0),
        0,
      );

      // Create PDF
      const doc = new PDFDocument({ margin: 50 });

      // Header
      doc.fontSize(20).text("Sales Report", { align: "center" });
      doc.moveDown();
      doc
        .fontSize(12)
        .text(`Period: ${fromDate} to ${toDate}`, { align: "center" });
      doc.moveDown();

      // Summary
      doc.fontSize(14).text("Summary", { underline: true });
      doc.fontSize(12);
      doc.text(`Total Invoices: ${sales.length}`);
      doc.text(`Total Sales: ₹${totalSales.toLocaleString("en-IN")}`);
      doc.text(`Total GST: ₹${totalGST.toLocaleString("en-IN")}`);
      doc.moveDown();

      // Table Header
      const startX = 50;
      let startY = doc.y;

      doc.fontSize(10);
      doc.text("Date", startX, startY);
      doc.text("Invoice No", startX + 80, startY);
      doc.text("Customer", startX + 160, startY);
      doc.text("Amount", startX + 280, startY);
      doc.text("GST", startX + 350, startY);
      doc.text("Status", startX + 420, startY);

      startY += 20;
      doc
        .moveTo(startX, startY)
        .lineTo(startX + 500, startY)
        .stroke();
      startY += 10;

      // Table Rows
      sales.forEach((sale) => {
        if (startY > 700) {
          doc.addPage();
          startY = 50;
        }

        doc.text(sale.date || "", startX, startY);
        doc.text(sale.invoice_no || "", startX + 80, startY);
        doc.text(
          (sale.party_name || "").substring(0, 20),
          startX + 160,
          startY,
        );
        doc.text(
          `₹${parseFloat(sale.total_amount || 0).toLocaleString("en-IN")}`,
          startX + 280,
          startY,
        );
        doc.text(
          `₹${parseFloat(sale.gst_amount || 0).toLocaleString("en-IN")}`,
          startX + 350,
          startY,
        );
        doc.text(sale.payment_status || "", startX + 420, startY);

        startY += 20;
      });

      doc.end();
      return doc;
    } catch (error) {
      console.error("Export sales report PDF error:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  // FIXED: Changed 'phone' to 'mobile'
  // Export Customer Report as PDF
  // Export Customer Report as PDF - Fixed version
  async exportCustomerReportPDF(tenantId, customerId, fromDate, toDate) {
    console.log("=== exportCustomerReportPDF called ===");
    console.log("Customer ID:", customerId);

    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      // Get customer details
      const customerDetails = await db.query(
        `SELECT id, name, email, mobile, address, gst_number, status
       FROM customers 
       WHERE id = ?`,
        [parseInt(customerId)],
      );

      console.log("Customer details query result:", customerDetails);

      if (!customerDetails || customerDetails.length === 0) {
        throw new Error(`Customer not found with ID: ${customerId}`);
      }

      const customer = customerDetails[0];
      console.log("Generating PDF for customer:", customer.name);

      // Get customer invoices
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

      console.log("Invoices found:", invoices.length);

      // Calculate totals
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

      // Create PDF
      const PDFDocument = require("pdfkit");
      const doc = new PDFDocument({ margin: 50 });

      // Header
      doc.fontSize(20).text("Customer Report", { align: "center" });
      doc.moveDown();
      doc
        .fontSize(12)
        .text(`Period: ${fromDate} to ${toDate}`, { align: "center" });
      doc.moveDown();

      // Customer Information - Use actual customer data
      doc.fontSize(14).text("Customer Information", { underline: true });
      doc.fontSize(12);
      doc.text(`Name: ${customer.name || "N/A"}`);
      doc.text(`Email: ${customer.email || "N/A"}`);
      doc.text(`Mobile: ${customer.mobile || "N/A"}`);
      doc.text(`Address: ${customer.address || "N/A"}`);
      doc.text(`GST Number: ${customer.gst_number || "N/A"}`);
      doc.text(`Status: ${customer.status || "Active"}`);
      doc.moveDown();

      // Summary
      doc.fontSize(14).text("Summary", { underline: true });
      doc.fontSize(12);
      doc.text(`Total Invoices: ${invoices.length}`);
      doc.text(`Total Purchases: ₹${totalPurchases.toLocaleString("en-IN")}`);
      doc.text(`Total GST: ₹${totalGST.toLocaleString("en-IN")}`);
      doc.text(
        `Outstanding Amount: ₹${outstandingAmount.toLocaleString("en-IN")}`,
      );
      doc.moveDown();

      // Invoice Table
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
      } else {
        doc
          .fontSize(12)
          .text("No invoices found for this period.", { align: "center" });
      }

      // Footer
      doc.moveDown();
      doc
        .fontSize(10)
        .text(`Report generated on: ${new Date().toLocaleString()}`, {
          align: "center",
          color: "gray",
        });

      return doc;
    } catch (error) {
      console.error("Export customer report PDF error:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  // Export Expenses Report as PDF
  // Export Expenses Report as PDF - Fixed (removed gst_amount)
  // Export Expenses Report as PDF - Fixed for your actual schema
  async exportExpensesReportPDF(tenantId, fromDate, toDate) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      // Fetch expenses data - using correct column names from your schema
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

      console.log("Expenses found:", expenses.length);

      // Calculate totals by category
      const categoryTotals = {};
      let totalExpenses = 0;

      expenses.forEach((expense) => {
        const amount = parseFloat(expense.totalAmount || expense.amount || 0);
        totalExpenses += amount;

        if (categoryTotals[expense.category]) {
          categoryTotals[expense.category] += amount;
        } else {
          categoryTotals[expense.category] = amount;
        }
      });

      // Create PDF
      const doc = new PDFDocument({ margin: 50 });

      // Header
      doc.fontSize(20).text("Expenses Report", { align: "center" });
      doc.moveDown();
      doc
        .fontSize(12)
        .text(`Period: ${fromDate} to ${toDate}`, { align: "center" });
      doc.moveDown();

      // Summary
      doc.fontSize(14).text("Summary", { underline: true });
      doc.fontSize(12);
      doc.text(`Total Expenses: ${expenses.length}`);
      doc.text(`Total Amount: ₹${totalExpenses.toLocaleString("en-IN")}`);
      doc.moveDown();

      // Category Breakdown
      doc.fontSize(14).text("Category Breakdown", { underline: true });
      doc.fontSize(12);

      Object.entries(categoryTotals).forEach(([category, amount]) => {
        const percentage =
          totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(2) : 0;
        doc.text(
          `${category}: ₹${amount.toLocaleString("en-IN")} (${percentage}%)`,
        );
      });

      doc.moveDown();

      // Table Header
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

      // Table Rows
      expenses.forEach((expense) => {
        if (startY > 700) {
          doc.addPage();
          startY = 50;
          // Re-add headers on new page
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
        const amount = parseFloat(expense.totalAmount || expense.amount || 0);
        const taxAmount = parseFloat(expense.taxAmount || 0);

        doc.text(date, startX, startY);
        doc.text(expense.category || "", startX + 100, startY);
        doc.text(
          (expense.description || "").substring(0, 35),
          startX + 180,
          startY,
        );
        doc.text(`₹${amount.toLocaleString("en-IN")}`, startX + 330, startY);
        doc.text(`₹${taxAmount.toLocaleString("en-IN")}`, startX + 420, startY);

        startY += 20;
      });

      doc.end();
      return doc;
    } catch (error) {
      console.error("Export expenses report PDF error:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  // Export Financial Report as PDF
  async exportFinancialReportPDF(tenantId, fromDate, toDate) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      // Get financial data
      const financialData = await this.getFinancialReport(
        tenantId,
        fromDate,
        toDate,
      );

      // Create PDF
      const doc = new PDFDocument({ margin: 50 });

      // Header
      doc.fontSize(20).text("Financial Report", { align: "center" });
      doc.moveDown();
      doc
        .fontSize(12)
        .text(`Period: ${fromDate} to ${toDate}`, { align: "center" });
      doc.moveDown();

      // Profit & Loss Statement
      doc.fontSize(16).text("Profit & Loss Statement", { align: "center" });
      doc.moveDown();

      doc.fontSize(12);
      doc.text("Income:", { underline: true });
      doc.text(
        `Total Sales: ₹${financialData.profit_loss.total_revenue.toLocaleString(
          "en-IN",
        )}`,
      );
      doc.moveDown();

      doc.text("Expenses:", { underline: true });
      doc.text(
        `Total Expenses: ₹${financialData.profit_loss.total_expenses.toLocaleString(
          "en-IN",
        )}`,
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
      doc.moveDown();

      // Expense Breakdown
      doc.fontSize(14).text("Expense Breakdown", { underline: true });
      doc.fontSize(12);

      if (financialData.expenses && financialData.expenses.length > 0) {
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

        financialData.expenses.forEach((expense) => {
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
        });
      }

      doc.end();
      return doc;
    } catch (error) {
      console.error("Export financial report PDF error:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  // Export as CSV
  async exportAsCSV(data, headers, filename) {
    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Report");

    // Add headers
    worksheet.addRow(headers);

    // Add data
    data.forEach((row) => {
      worksheet.addRow(Object.values(row));
    });

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      column.width = 15;
    });

    return workbook;
  }
}

module.exports = new ReportService();
