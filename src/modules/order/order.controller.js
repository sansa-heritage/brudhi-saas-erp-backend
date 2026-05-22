const OrderService = require("./order.service");
const ResponseUtil = require("../../utils/response");
const logger = require("../../config/logger");

class OrderController {
  // Create new order
  async createOrder(req, res) {
    try {
      const tenantId = req.user.tenant_id;

      const orderData = {
        ...req.body,
        created_by: req.user.id,
      };

      const orderId = await OrderService.createOrder(orderData, tenantId);
      const order = await OrderService.getOrderById(orderId, tenantId);

      return ResponseUtil.success(
        res,
        order,
        "Order created successfully",
        201,
      );
    } catch (error) {
      console.error("Create order error:", error);
      return ResponseUtil.error(
        res,
        "Failed to create order",
        500,
        error.message,
      );
    }
  }

  // Get all orders
  async getAllOrders(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const {
        page = 1,
        limit = 10,
        customer_id,
        customer_type,
        order_type,
        status,
        payment_status,
        search,
        from_date,
        to_date,
      } = req.query;

      const filters = {
        customer_id,
        customer_type,
        order_type,
        status,
        payment_status,
        search,
        from_date,
        to_date,
      };

      const result = await OrderService.getAllOrders(tenantId, filters, {
        page,
        limit,
      });
      const stats = await OrderService.getOrderStats(tenantId);

      return ResponseUtil.success(
        res,
        {
          orders: result.data,
          pagination: result.pagination,
          statistics: stats,
        },
        "Orders retrieved successfully",
      );
    } catch (error) {
      console.error("Get orders error:", error);
      return ResponseUtil.error(
        res,
        "Failed to retrieve orders",
        500,
        error.message,
      );
    }
  }

  // Get order by ID
  async getOrderById(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;

      const order = await OrderService.getOrderById(id, tenantId);

      if (!order) {
        return ResponseUtil.notFound(res, "Order not found");
      }

      return ResponseUtil.success(res, order, "Order retrieved successfully");
    } catch (error) {
      console.error("Get order error:", error);
      return ResponseUtil.error(
        res,
        "Failed to retrieve order",
        500,
        error.message,
      );
    }
  }

  // ============ ADD THIS UPDATE ORDER METHOD ============
  // Update order
  async updateOrder(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;
      const orderData = {
        ...req.body,
        updated_by: req.user.id,
      };

      console.log(`Updating order ${id} with data:`, orderData);

      const updated = await OrderService.updateOrder(id, orderData, tenantId);

      if (!updated) {
        return ResponseUtil.error(res, "Failed to update order", 500);
      }

      const order = await OrderService.getOrderById(id, tenantId);

      return ResponseUtil.success(res, order, "Order updated successfully");
    } catch (error) {
      console.error("Update order error:", error);
      return ResponseUtil.error(
        res,
        "Failed to update order",
        500,
        error.message,
      );
    }
  }
  // ============ END OF UPDATE ORDER METHOD ============

  // Update order status
  async updateOrderStatus(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;

      const statusData = {
        status: req.body.status,
        remarks: req.body.remarks,
        changed_by: req.user.id, // Get from logged-in user
      };

      const updated = await OrderService.updateOrderStatus(
        id,
        tenantId,
        statusData,
      );

      if (!updated) {
        return ResponseUtil.error(res, "Failed to update order status", 500);
      }

      const order = await OrderService.getOrderById(id, tenantId);

      return ResponseUtil.success(
        res,
        order,
        "Order status updated successfully",
      );
    } catch (error) {
      console.error("Update order status error:", error);
      return ResponseUtil.error(
        res,
        "Failed to update order status",
        500,
        error.message,
      );
    }
  }

  // Update payment status
  async updatePaymentStatus(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;

      const paymentData = {
        payment_status: req.body.payment_status,
      };

      const updated = await OrderService.updatePaymentStatus(
        id,
        tenantId,
        paymentData,
      );

      if (!updated) {
        return ResponseUtil.error(res, "Failed to update payment status", 500);
      }

      const order = await OrderService.getOrderById(id, tenantId);

      return ResponseUtil.success(
        res,
        order,
        "Payment status updated successfully",
      );
    } catch (error) {
      console.error("Update payment status error:", error);
      return ResponseUtil.error(
        res,
        "Failed to update payment status",
        500,
        error.message,
      );
    }
  }

  // Cancel order
  async cancelOrder(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;

      const cancelData = {
        reason: req.body.reason,
        cancelled_by: req.user.id, // Get from logged-in user
      };

      const cancelled = await OrderService.cancelOrder(
        id,
        tenantId,
        cancelData,
      );

      if (!cancelled) {
        return ResponseUtil.error(res, "Failed to cancel order", 500);
      }

      const order = await OrderService.getOrderById(id, tenantId);

      return ResponseUtil.success(res, order, "Order cancelled successfully");
    } catch (error) {
      console.error("Cancel order error:", error);
      return ResponseUtil.error(
        res,
        error.message || "Failed to cancel order",
        500,
      );
    }
  }

  // Delete order (soft delete)
  async deleteOrder(req, res) {
    try {
      const id = Number(req.params.id);

      if (!id || isNaN(id)) {
        return ResponseUtil.error(res, "Invalid order ID", 400);
      }

      await OrderService.deleteOrder(req.tenantId, id);

      return ResponseUtil.success(res, null, "Order deleted successfully");
    } catch (error) {
      logger.error("Delete order error:", error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  // Get order statistics
  async getOrderStatistics(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const stats = await OrderService.getOrderStats(tenantId);

      return ResponseUtil.success(
        res,
        stats,
        "Order statistics retrieved successfully",
      );
    } catch (error) {
      console.error("Get order statistics error:", error);
      return ResponseUtil.error(
        res,
        "Failed to retrieve statistics",
        500,
        error.message,
      );
    }
  }
}

module.exports = new OrderController();