const SubscriptionService = require("./subscription.service");
const ResponseUtil = require("../../utils/response");
const logger = require("../../config/logger");

class SubscriptionController {
  // Create new subscription
  async createSubscription(req, res) {
    try {
      const tenantId = req.user.tenant_id;

      const subscriptionData = {
        ...req.body,
        created_by: req.user.id,
      };

      const subscriptionId = await SubscriptionService.createSubscription(
        subscriptionData,
        tenantId,
      );
      const subscription = await SubscriptionService.getSubscriptionById(
        subscriptionId,
        tenantId,
      );

      return ResponseUtil.success(
        res,
        subscription,
        "Subscription created successfully",
        201,
      );
    } catch (error) {
      console.error("Create subscription error:", error);
      return ResponseUtil.error(
        res,
        "Failed to create subscription",
        500,
        error.message,
      );
    }
  }
  // Get all subscriptions
  async getAllSubscriptions(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const {
        page = 1,
        limit = 10,
        status,
        plan_type,
        search,
        expiring_soon,
      } = req.query;

      const filters = { status, plan_type, search, expiring_soon };
      const result = await SubscriptionService.getAllSubscriptions(
        tenantId,
        filters,
        { page, limit },
      );
      const stats = await SubscriptionService.getSubscriptionStats(tenantId);

      return ResponseUtil.success(
        res,
        {
          subscriptions: result.data,
          pagination: result.pagination,
          statistics: stats,
        },
        "Subscriptions retrieved successfully",
      );
    } catch (error) {
      console.error("Get subscriptions error:", error);
      return ResponseUtil.error(
        res,
        "Failed to retrieve subscriptions",
        500,
        error.message,
      );
    }
  }

  // Get subscription by ID
  async getSubscriptionById(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;

      const subscription = await SubscriptionService.getSubscriptionById(
        id,
        tenantId,
      );

      if (!subscription) {
        return ResponseUtil.notFound(res, "Subscription not found");
      }

      return ResponseUtil.success(
        res,
        subscription,
        "Subscription retrieved successfully",
      );
    } catch (error) {
      console.error("Get subscription error:", error);
      return ResponseUtil.error(
        res,
        "Failed to retrieve subscription",
        500,
        error.message,
      );
    }
  }

  // Get tenant subscription
  async getTenantSubscription(req, res) {
    try {
      const tenantId = req.user.tenant_id;

      const subscription =
        await SubscriptionService.getTenantSubscription(tenantId);

      return ResponseUtil.success(
        res,
        subscription,
        "Tenant subscription retrieved successfully",
      );
    } catch (error) {
      console.error("Get tenant subscription error:", error);
      return ResponseUtil.error(
        res,
        "Failed to retrieve tenant subscription",
        500,
        error.message,
      );
    }
  }

  // Renew subscription
  async renewSubscription(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;

      const renewData = {
        ...req.body,
        renewed_by: req.user.id,
      };

      const renewed = await SubscriptionService.renewSubscription(
        id,
        tenantId,
        renewData,
      );

      if (!renewed) {
        return ResponseUtil.error(res, "Failed to renew subscription", 500);
      }

      const subscription = await SubscriptionService.getSubscriptionById(
        id,
        tenantId,
      );

      return ResponseUtil.success(
        res,
        subscription,
        "Subscription renewed successfully",
      );
    } catch (error) {
      console.error("Renew subscription error:", error);
      return ResponseUtil.error(
        res,
        error.message || "Failed to renew subscription",
        500,
      );
    }
  }

  // Cancel subscription
  async cancelSubscription(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;

      const cancelData = {
        reason: req.body.reason,
        cancelled_by: req.user.id,
      };

      const cancelled = await SubscriptionService.cancelSubscription(
        id,
        tenantId,
        cancelData,
      );

      if (!cancelled) {
        return ResponseUtil.error(res, "Failed to cancel subscription", 500);
      }

      const subscription = await SubscriptionService.getSubscriptionById(
        id,
        tenantId,
      );

      return ResponseUtil.success(
        res,
        subscription,
        "Subscription cancelled successfully",
      );
    } catch (error) {
      console.error("Cancel subscription error:", error);
      return ResponseUtil.error(
        res,
        error.message || "Failed to cancel subscription",
        500,
      );
    }
  }

  // Record payment
  async recordPayment(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;

      const paymentData = {
        ...req.body,
        created_by: req.user.id,
      };

      const paymentId = await SubscriptionService.recordPayment(
        id,
        paymentData,
        tenantId,
      );

      return ResponseUtil.success(
        res,
        { payment_id: paymentId },
        "Payment recorded successfully",
        201,
      );
    } catch (error) {
      console.error("Record payment error:", error);
      return ResponseUtil.error(
        res,
        "Failed to record payment",
        500,
        error.message,
      );
    }
  }

  // Get subscription statistics
  async getSubscriptionStatistics(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const stats = await SubscriptionService.getSubscriptionStats(tenantId);
      const expiredUpdated =
        await SubscriptionService.updateExpiredSubscriptions(tenantId);

      return ResponseUtil.success(
        res,
        {
          statistics: stats,
          expired_updated: expiredUpdated,
        },
        "Subscription statistics retrieved successfully",
      );
    } catch (error) {
      console.error("Get subscription statistics error:", error);
      return ResponseUtil.error(
        res,
        "Failed to retrieve statistics",
        500,
        error.message,
      );
    }
  }

  async updateExpiredSubscriptions(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const updatedCount =
        await SubscriptionService.updateExpiredSubscriptions(tenantId);

      return ResponseUtil.success(
        res,
        {
          updated_count: updatedCount,
          message: `Updated ${updatedCount} expired subscriptions`,
        },
        "Expired subscriptions updated successfully",
      );
    } catch (error) {
      console.error("Update expired subscriptions error:", error);
      return ResponseUtil.error(
        res,
        "Failed to update expired subscriptions",
        500,
        error.message,
      );
    }
  }
}

module.exports = new SubscriptionController();
