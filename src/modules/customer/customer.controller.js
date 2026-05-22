const CustomerService = require("./customer.service");
const ResponseUtil = require("../../utils/response");
const logger = require("../../config/logger");

class CustomerController {
  async getAllCustomers(req, res) {
    try {
      const filters = {
        status: req.query.status,
        search: req.query.search,
        customerType: req.query.customerType,
        page: req.query.page,
        limit: req.query.limit,
      };

      const result = await CustomerService.getAllCustomers(
        req.tenantId,
        filters,
      );

      return ResponseUtil.success(
        res,
        result,
        "Customers fetched successfully",
      );
    } catch (error) {
      logger.error("Get all customers error:", error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  async getCustomerById(req, res) {
    try {
      const id = Number(req.params.id);

      if (!id || isNaN(id)) {
        return ResponseUtil.error(res, "Invalid customer ID", 400);
      }

      const customer = await CustomerService.getCustomerById(req.tenantId, id);

      if (!customer) {
        return ResponseUtil.notFound(res, "Customer not found");
      }

      return ResponseUtil.success(
        res,
        customer,
        "Customer fetched successfully",
      );
    } catch (error) {
      logger.error("Get customer by id error:", error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  async createCustomer(req, res) {
    try {
      const tenantId = Number(req.tenantId);

      if (!tenantId || isNaN(tenantId)) {
        return ResponseUtil.error(res, "Invalid tenant ID", 400);
      }

      const customerData = {
        ...req.body,
        createdBy: req.user.id,
      };

      const customerId = await CustomerService.createCustomer(
        tenantId,
        customerData,
      );

      const customer = await CustomerService.getCustomerById(
        tenantId,
        customerId,
      );

      return ResponseUtil.created(
        res,
        customer,
        "Customer created successfully",
      );
    } catch (error) {
      logger.error("Create customer error:", error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  // async updateCustomer(req, res) {
  //   try {
  //     const id = Number(req.params.id);

  //     if (!id || isNaN(id)) {
  //       return ResponseUtil.error(res, "Invalid customer ID", 400);
  //     }

  //     await CustomerService.updateCustomer(req.tenantId, id, req.body);

  //     const customer = await CustomerService.getCustomerById(req.tenantId, id);

  //     return ResponseUtil.success(
  //       res,
  //       customer,
  //       "Customer updated successfully",
  //     );
  //   } catch (error) {
  //     logger.error("Update customer error:", error);
  //     return ResponseUtil.error(res, error.message, 400);
  //   }
  // }

  async updateCustomer(req, res) {
    try {
      const id = Number(req.params.id);
      console.log("Updating customer ID:", id);
      console.log("Received update data:", req.body);

      if (!id || isNaN(id)) {
        return ResponseUtil.error(res, "Invalid customer ID", 400);
      }

      await CustomerService.updateCustomer(req.tenantId, id, req.body);

      const customer = await CustomerService.getCustomerById(req.tenantId, id);

      return ResponseUtil.success(
        res,
        customer,
        "Customer updated successfully",
      );
    } catch (error) {
      logger.error("Update customer error:", error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }
  async deleteCustomer(req, res) {
    try {
      const id = Number(req.params.id);

      if (!id || isNaN(id)) {
        return ResponseUtil.error(res, "Invalid customer ID", 400);
      }

      await CustomerService.deleteCustomer(req.tenantId, id);

      return ResponseUtil.success(res, null, "Customer deleted successfully");
    } catch (error) {
      logger.error("Delete customer error:", error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }
}

module.exports = new CustomerController();
