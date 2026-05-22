const DatabaseManager = require("../../services/database-manager.service");

class ExpenseService {
  // Generate unique reference number
  generateReferenceNo() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const timestamp = Date.now().toString().slice(-6);

    return `EXP-${year}${month}${day}-${timestamp}`;
  }

  async getAllExpenses(tenantId, filters = {}) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      let query = "SELECT * FROM expenses WHERE 1=1";
      const params = [];

      if (filters.category) {
        query += " AND category = ?";
        params.push(filters.category);
      }

      if (filters.fromDate) {
        query += " AND expense_date >= ?";
        params.push(filters.fromDate);
      }

      if (filters.toDate) {
        query += " AND expense_date <= ?";
        params.push(filters.toDate);
      }

      query += " ORDER BY expense_date DESC";

      const page = Number(filters.page) || 1;
      const limit = Math.min(100, Number(filters.limit) || 10);
      const offset = (page - 1) * limit;

      query += " LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const [expenses] = await db.query(query, params);

      const [countResult] = await db.query(
        "SELECT COUNT(*) as total FROM expenses",
      );

      const total = countResult[0]?.total || 0;

      return {
        data: expenses,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } finally {
      await db.end();
    }
  }

  async getExpenseById(tenantId, id) {
    if (!id || isNaN(id)) {
      throw new Error("Invalid expense ID");
    }

    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      const [expenses] = await db.query("SELECT * FROM expenses WHERE id = ?", [
        Number(id),
      ]);

      return expenses[0] || null;
    } finally {
      await db.end();
    }
  }

  async createExpense(tenantId, expenseData) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      // Auto-generate reference number
      const referenceNo = this.generateReferenceNo();

      // Ensure date is in YYYY-MM-DD format
      let expenseDate = expenseData.expenseDate || expenseData.expense_date;
      if (expenseDate && expenseDate.includes("T")) {
        expenseDate = expenseDate.split("T")[0];
      }

      // Ensure numeric values are properly calculated
      const amount = parseFloat(expenseData.amount) || 0;
      const taxAmount = parseFloat(expenseData.taxAmount) || 0;
      const totalAmount = expenseData.totalAmount
        ? parseFloat(expenseData.totalAmount)
        : amount + taxAmount;

      const [result] = await db.query(
        `INSERT INTO expenses (
          category, expense_date, amount, tax_amount, total_amount, 
          description, reference_no, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          expenseData.category,
          expenseDate,
          amount,
          taxAmount,
          totalAmount,
          expenseData.description || null,
          referenceNo,
          expenseData.createdBy || null,
        ],
      );

      // Get the created expense
      const [newExpense] = await db.query(
        "SELECT * FROM expenses WHERE id = ?",
        [result.insertId],
      );

      return {
        success: true,
        message: "Expense created successfully",
        data: newExpense[0],
      };
    } catch (error) {
      console.error("Error creating expense:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  async updateExpense(tenantId, id, expenseData) {
    if (!id || isNaN(id)) {
      throw new Error("Invalid expense ID");
    }

    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      const updates = [];
      const params = [];

      // Map frontend fields to database fields (without receipt_path)
      const fieldMapping = {
        category: "category",
        expenseDate: "expense_date",
        expense_date: "expense_date",
        amount: "amount",
        taxAmount: "tax_amount",
        tax_amount: "tax_amount",
        totalAmount: "total_amount",
        total_amount: "total_amount",
        description: "description",
      };

      for (const [frontendField, dbField] of Object.entries(fieldMapping)) {
        let value = expenseData[frontendField];

        if (value !== undefined) {
          // Handle date formatting
          if (dbField === "expense_date" && value) {
            if (value.includes("T")) {
              value = value.split("T")[0];
            }
          }

          // Handle numeric values
          if (
            dbField === "amount" ||
            dbField === "tax_amount" ||
            dbField === "total_amount"
          ) {
            value = parseFloat(value) || 0;
          }

          updates.push(`${dbField} = ?`);
          params.push(value);
        }
      }

      if (updates.length === 0) {
        return { success: true, message: "No fields to update" };
      }

      params.push(Number(id));

      await db.query(
        `UPDATE expenses
         SET ${updates.join(", ")}, updated_at = NOW()
         WHERE id = ?`,
        params,
      );

      // Get the updated expense
      const [updatedExpense] = await db.query(
        "SELECT * FROM expenses WHERE id = ?",
        [id],
      );

      return {
        success: true,
        message: "Expense updated successfully",
        data: updatedExpense[0],
      };
    } catch (error) {
      console.error("Error updating expense:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  async deleteExpense(tenantId, id) {
    if (!id || isNaN(id)) {
      throw new Error("Invalid expense ID");
    }

    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      await db.query("DELETE FROM expenses WHERE id = ?", [Number(id)]);
      return {
        success: true,
        message: "Expense deleted successfully",
      };
    } catch (error) {
      console.error("Error deleting expense:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  async getExpenseCategories(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      const [categories] = await db.query(
        "SELECT DISTINCT category FROM expenses ORDER BY category",
      );
      return categories.map((c) => c.category);
    } finally {
      await db.end();
    }
  }

  async getExpenseStatistics(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      // Total expenses count
      const [totalResult] = await db.query(
        "SELECT COUNT(*) as total FROM expenses",
      );

      // Total amount sum
      const [amountResult] = await db.query(
        "SELECT SUM(amount) as totalAmount FROM expenses",
      );

      // Total tax sum
      const [taxResult] = await db.query(
        "SELECT SUM(tax_amount) as totalTax FROM expenses",
      );

      // Monthly expenses for current year
      const [monthlyResult] = await db.query(`
        SELECT 
          MONTH(expense_date) as month,
          SUM(amount) as totalAmount,
          SUM(tax_amount) as totalTax,
          COUNT(*) as count
        FROM expenses 
        WHERE YEAR(expense_date) = YEAR(CURDATE())
        GROUP BY MONTH(expense_date)
        ORDER BY month ASC
      `);

      // Expenses by category
      const [categoryResult] = await db.query(`
        SELECT 
          category,
          COUNT(*) as count,
          SUM(amount) as totalAmount,
          SUM(tax_amount) as totalTax
        FROM expenses 
        GROUP BY category
        ORDER BY totalAmount DESC
      `);

      return {
        totalExpenses: totalResult[0]?.total || 0,
        totalAmount: amountResult[0]?.totalAmount || 0,
        totalTax: taxResult[0]?.totalTax || 0,
        monthlyBreakdown: monthlyResult,
        categoryBreakdown: categoryResult,
      };
    } catch (error) {
      console.error("Error getting expense statistics:", error);
      throw error;
    } finally {
      await db.end();
    }
  }
}

module.exports = new ExpenseService();
