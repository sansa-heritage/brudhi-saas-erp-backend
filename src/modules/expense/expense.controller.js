// const ExpenseService = require("./expense.service");
// const ResponseUtil = require("../../utils/response");
// const logger = require("../../config/logger");

// class ExpenseController {
//   async getAllExpenses(req, res) {
//     try {
//       const filters = {
//         category: req.query.category,
//         fromDate: req.query.fromDate,
//         toDate: req.query.toDate,
//         page: req.query.page,
//         limit: req.query.limit,
//       };

//       const result = await ExpenseService.getAllExpenses(req.tenantId, filters);

//       return ResponseUtil.success(res, result, "Expenses fetched successfully");
//     } catch (error) {
//       logger.error("Get all expenses error:", error);
//       return ResponseUtil.error(res, error.message, 500);
//     }
//   }

//   async getExpenseById(req, res) {
//     try {
//       const id = Number(req.params.id);

//       if (!id || isNaN(id)) {
//         return ResponseUtil.error(res, "Invalid expense ID", 400);
//       }

//       const expense = await ExpenseService.getExpenseById(req.tenantId, id);

//       if (!expense) {
//         return ResponseUtil.notFound(res, "Expense not found");
//       }

//       return ResponseUtil.success(res, expense, "Expense fetched successfully");
//     } catch (error) {
//       logger.error("Get expense by id error:", error);
//       return ResponseUtil.error(res, error.message, 500);
//     }
//   }

//   async createExpense(req, res) {
//     try {
//       const tenantId = Number(req.tenantId);

//       if (!tenantId || isNaN(tenantId)) {
//         return ResponseUtil.error(res, "Invalid tenant ID", 400);
//       }

//       const expenseData = {
//         ...req.body,
//         createdBy: req.user.id,
//       };

//       const expenseId = await ExpenseService.createExpense(
//         tenantId,
//         expenseData,
//       );

//       const expense = await ExpenseService.getExpenseById(tenantId, expenseId);

//       return ResponseUtil.created(res, expense, "Expense created successfully");
//     } catch (error) {
//       logger.error("Create expense error:", error);
//       return ResponseUtil.error(res, error.message, 400);
//     }
//   }

//   async updateExpense(req, res) {
//     try {
//       const id = Number(req.params.id);

//       if (!id || isNaN(id)) {
//         return ResponseUtil.error(res, "Invalid expense ID", 400);
//       }

//       await ExpenseService.updateExpense(req.tenantId, id, req.body);

//       const expense = await ExpenseService.getExpenseById(req.tenantId, id);

//       if (!expense) {
//         return ResponseUtil.notFound(res, "Expense not found");
//       }

//       return ResponseUtil.success(res, expense, "Expense updated successfully");
//     } catch (error) {
//       logger.error("Update expense error:", error);
//       return ResponseUtil.error(res, error.message, 400);
//     }
//   }

//   async deleteExpense(req, res) {
//     try {
//       const id = Number(req.params.id);

//       if (!id || isNaN(id)) {
//         return ResponseUtil.error(res, "Invalid expense ID", 400);
//       }

//       await ExpenseService.deleteExpense(req.tenantId, id);

//       return ResponseUtil.success(res, null, "Expense deleted successfully");
//     } catch (error) {
//       logger.error("Delete expense error:", error);
//       return ResponseUtil.error(res, error.message, 400);
//     }
//   }

//   async getExpenseCategories(req, res) {
//     try {
//       const categories = await ExpenseService.getExpenseCategories(
//         req.tenantId,
//       );

//       return ResponseUtil.success(
//         res,
//         categories,
//         "Expense categories fetched successfully",
//       );
//     } catch (error) {
//       logger.error("Get expense categories error:", error);
//       return ResponseUtil.error(res, error.message, 500);
//     }
//   }
// }

// module.exports = new ExpenseController();


// expense.controller.js
const expenseService = require("./expense.service");
const ResponseUtil = require("../../utils/response");
const logger = require("../../config/logger");

const createExpense = async (req, res) => {
  try {
    console.log("Creating expense with data:", req.body);
    
    // createExpense now returns { success, message, data }
    const result = await expenseService.createExpense(req.tenantId, req.body);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || "Failed to create expense",
        timestamp: new Date().toISOString()
      });
    }
    
    res.status(201).json({
      success: true,
      message: "Expense created successfully",
      data: result.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Create expense error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to create expense",
      timestamp: new Date().toISOString()
    });
  }
};

const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense ID"
      });
    }
    
    const result = await expenseService.updateExpense(req.tenantId, id, req.body);
    
    res.json({
      success: true,
      message: result.message || "Expense updated successfully",
      data: result.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Update expense error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to update expense",
      timestamp: new Date().toISOString()
    });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense ID"
      });
    }
    
    const result = await expenseService.deleteExpense(req.tenantId, id);
    
    res.json({
      success: true,
      message: result.message || "Expense deleted successfully",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Delete expense error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to delete expense",
      timestamp: new Date().toISOString()
    });
  }
};

const getExpenseById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense ID"
      });
    }
    
    const expense = await expenseService.getExpenseById(req.tenantId, id);
    
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found"
      });
    }
    
    res.json({
      success: true,
      data: expense,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Get expense error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to get expense",
      timestamp: new Date().toISOString()
    });
  }
};

const getAllExpenses = async (req, res) => {
  try {
    const filters = {
      category: req.query.category,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      page: req.query.page,
      limit: req.query.limit,
    };
    
    const result = await expenseService.getAllExpenses(req.tenantId, filters);
    
    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Get expenses error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to get expenses",
      timestamp: new Date().toISOString()
    });
  }
};

const getExpenseCategories = async (req, res) => {
  try {
    const categories = await expenseService.getExpenseCategories(req.tenantId);
    
    res.json({
      success: true,
      data: categories,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to get categories",
      timestamp: new Date().toISOString()
    });
  }
};

const getExpenseStatistics = async (req, res) => {
  try {
    const stats = await expenseService.getExpenseStatistics(req.tenantId);
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Get statistics error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to get statistics",
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseById,
  getAllExpenses,
  getExpenseCategories,
  getExpenseStatistics,
};
