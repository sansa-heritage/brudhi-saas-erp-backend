const UserService = require("./user.service");
const ResponseUtil = require("../../utils/response");
const logger = require("../../config/logger");

class UserController {
  async getAllUsers(req, res) {
    try {
      const filters = {
        role: req.query.role,
        status: req.query.status,
        search: req.query.search,
        page: req.query.page,
        limit: req.query.limit,
      };

      const result = await UserService.getAllUsers(req.tenantId, filters);
      return ResponseUtil.success(res, result, "Users fetched successfully");
    } catch (error) {
      logger.error("Get all users error:", error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  async getUserById(req, res) {
    try {
      const user = await UserService.getUserById(req.tenantId, req.params.id);
      if (!user) {
        return ResponseUtil.notFound(res, "User not found");
      }
      return ResponseUtil.success(res, user, "User fetched successfully");
    } catch (error) {
      logger.error("Get user by id error:", error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  async createUser(req, res) {
    try {
      const userData = { ...req.body, createdBy: req.user.id };
      const userId = await UserService.createUser(req.tenantId, userData);
      const user = await UserService.getUserById(req.tenantId, userId);
      return ResponseUtil.created(res, user, "User created successfully");
    } catch (error) {
      logger.error("Create user error:", error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  async updateUser(req, res) {
    try {
      await UserService.updateUser(req.tenantId, req.params.id, req.body);
      const user = await UserService.getUserById(req.tenantId, req.params.id);
      return ResponseUtil.success(res, user, "User updated successfully");
    } catch (error) {
      logger.error("Update user error:", error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  async deleteUser(req, res) {
    try {
      await UserService.deleteUser(req.tenantId, req.params.id);
      return ResponseUtil.success(res, null, "User deleted successfully");
    } catch (error) {
      logger.error("Delete user error:", error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  async resetPassword(req, res) {
    try {
      const { newPassword } = req.body;
      await UserService.resetPassword(req.tenantId, req.params.id, newPassword);
      return ResponseUtil.success(res, null, "Password reset successfully");
    } catch (error) {
      logger.error("Reset password error:", error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }
}

module.exports = new UserController();
