// const DealerService = require("./dealer.service");
// const ResponseUtil = require("../../utils/response");
// const logger = require("../../config/logger");

// class DealerController {
//   async getAllDealers(req, res) {
//     try {
//       const filters = {
//         status: req.query.status,
//         search: req.query.search,
//         dealerType: req.query.dealerType,
//         page: req.query.page,
//         limit: req.query.limit,
//       };

//       const result = await DealerService.getAllDealers(req.tenantId, filters);

//       return ResponseUtil.success(res, result, "Dealers fetched successfully");
//     } catch (error) {
//       logger.error("Get all dealers error:", error);
//       return ResponseUtil.error(res, error.message, 500);
//     }
//   }

//   async getDealerById(req, res) {
//     try {
//       const id = Number(req.params.id);

//       if (!id || isNaN(id)) {
//         return ResponseUtil.error(res, "Invalid dealer ID", 400);
//       }

//       const dealer = await DealerService.getDealerById(req.tenantId, id);

//       if (!dealer) {
//         return ResponseUtil.notFound(res, "Dealer not found");
//       }

//       return ResponseUtil.success(res, dealer, "Dealer fetched successfully");
//     } catch (error) {
//       logger.error("Get dealer by id error:", error);
//       return ResponseUtil.error(res, error.message, 500);
//     }
//   }

//   async createDealer(req, res) {
//     try {
//       const tenantId = Number(req.tenantId);

//       if (!tenantId || isNaN(tenantId)) {
//         return ResponseUtil.error(res, "Invalid tenant ID", 400);
//       }

//       const dealerData = {
//         ...req.body,
//         createdBy: req.user.id,
//       };

//       const dealerId = await DealerService.createDealer(tenantId, dealerData);

//       const dealer = await DealerService.getDealerById(tenantId, dealerId);

//       return ResponseUtil.created(res, dealer, "Dealer created successfully");
//     } catch (error) {
//       logger.error("Create dealer error:", error);
//       return ResponseUtil.error(res, error.message, 400);
//     }
//   }

//   async updateDealer(req, res) {
//     try {
//       const id = Number(req.params.id);

//       if (!id || isNaN(id)) {
//         return ResponseUtil.error(res, "Invalid dealer ID", 400);
//       }

//       await DealerService.updateDealer(req.tenantId, id, req.body);

//       const dealer = await DealerService.getDealerById(req.tenantId, id);

//       return ResponseUtil.success(res, dealer, "Dealer updated successfully");
//     } catch (error) {
//       logger.error("Update dealer error:", error);
//       return ResponseUtil.error(res, error.message, 400);
//     }
//   }

//   async deleteDealer(req, res) {
//     try {
//       const id = Number(req.params.id);

//       if (!id || isNaN(id)) {
//         return ResponseUtil.error(res, "Invalid dealer ID", 400);
//       }

//       await DealerService.deleteDealer(req.tenantId, id);

//       return ResponseUtil.success(res, null, "Dealer deleted successfully");
//     } catch (error) {
//       logger.error("Delete dealer error:", error);
//       return ResponseUtil.error(res, error.message, 400);
//     }
//   }
// }

// module.exports = new DealerController();

// backend/controllers/dealer.controller.js
const DealerService = require("./dealer.service");
const ResponseUtil = require("../../utils/response");
const logger = require("../../config/logger");

class DealerController {
  async getAllDealers(req, res) {
    try {
      const filters = {
        status: req.query.status,
        search: req.query.search,
        dealerType: req.query.dealerType,
        page: req.query.page,
        limit: req.query.limit,
      };

      const result = await DealerService.getAllDealers(req.tenantId, filters);

      return ResponseUtil.success(res, result, "Dealers fetched successfully");
    } catch (error) {
      logger.error("Get all dealers error:", error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  async getDealerById(req, res) {
    try {
      const id = Number(req.params.id);

      if (!id || isNaN(id)) {
        return ResponseUtil.error(res, "Invalid dealer ID", 400);
      }

      const dealer = await DealerService.getDealerById(req.tenantId, id);

      if (!dealer) {
        return ResponseUtil.notFound(res, "Dealer not found");
      }

      return ResponseUtil.success(res, dealer, "Dealer fetched successfully");
    } catch (error) {
      logger.error("Get dealer by id error:", error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  async createDealer(req, res) {
    try {
      const tenantId = Number(req.tenantId);

      if (!tenantId || isNaN(tenantId)) {
        return ResponseUtil.error(res, "Invalid tenant ID", 400);
      }

      // Validate required fields
      const { name, email, mobile } = req.body;

      if (!name || !name.trim()) {
        return ResponseUtil.error(res, "Dealer name is required", 400);
      }

      if (!email || !email.trim()) {
        return ResponseUtil.error(res, "Email is required", 400);
      }

      if (!email.match(/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/)) {
        return ResponseUtil.error(
          res,
          "Please enter a valid email address",
          400,
        );
      }

      if (!mobile || !mobile.trim()) {
        return ResponseUtil.error(res, "Mobile number is required", 400);
      }

      if (!mobile.match(/^[6-9]\d{9}$/)) {
        return ResponseUtil.error(
          res,
          "Please enter a valid 10-digit mobile number",
          400,
        );
      }

      const dealerData = {
        ...req.body,
        createdBy: req.user.id,
      };

      const dealerId = await DealerService.createDealer(tenantId, dealerData);

      const dealer = await DealerService.getDealerById(tenantId, dealerId);

      return ResponseUtil.created(res, dealer, "Dealer created successfully");
    } catch (error) {
      logger.error("Create dealer error:", error);

      // Handle duplicate email error
      if (error.message === "Email already exists") {
        return ResponseUtil.error(res, error.message, 400);
      }

      return ResponseUtil.error(res, error.message, 400);
    }
  }

  // async updateDealer(req, res) {
  //   try {
  //     const id = Number(req.params.id);
  //     console.log("Updating dealer ID:", id);
  //     console.log("Received update data:", req.body);

  //     if (!id || isNaN(id)) {
  //       return ResponseUtil.error(res, "Invalid dealer ID", 400);
  //     }

  //     // Optional: Add validation for update if needed
  //     if (
  //       req.body.email &&
  //       !req.body.email.match(/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/)
  //     ) {
  //       return ResponseUtil.error(
  //         res,
  //         "Please enter a valid email address",
  //         400,
  //       );
  //     }

  //     if (req.body.mobile && !req.body.mobile.match(/^[6-9]\d{9}$/)) {
  //       return ResponseUtil.error(
  //         res,
  //         "Please enter a valid 10-digit mobile number",
  //         400,
  //       );
  //     }

  //     await DealerService.updateDealer(req.tenantId, id, req.body);

  //     const dealer = await DealerService.getDealerById(req.tenantId, id);

  //     return ResponseUtil.success(res, dealer, "Dealer updated successfully");
  //   } catch (error) {
  //     logger.error("Update dealer error:", error);

  //     if (error.message === "Dealer not found") {
  //       return ResponseUtil.notFound(res, error.message);
  //     }

  //     if (error.message === "Email already exists") {
  //       return ResponseUtil.error(res, error.message, 400);
  //     }

  //     return ResponseUtil.error(res, error.message, 400);
  //   }
  // }

  // backend/controllers/dealer.controller.js

  async updateDealer(req, res) {
    try {
      const id = Number(req.params.id);
      console.log("Updating dealer ID:", id);
      console.log("Received update data:", JSON.stringify(req.body, null, 2));

      if (!id || isNaN(id)) {
        return ResponseUtil.error(res, "Invalid dealer ID", 400);
      }

      // Validate commission rate if provided
      if (req.body.commissionRate !== undefined) {
        const commissionRate = parseFloat(req.body.commissionRate);
        if (isNaN(commissionRate) || commissionRate < 0) {
          return ResponseUtil.error(
            res,
            "Commission rate must be a positive number",
            400,
          );
        }
        // Convert to snake_case for backend processing
        req.body.commission_rate = commissionRate;
      }

      // Validate email if provided
      if (
        req.body.email &&
        !req.body.email.match(/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/)
      ) {
        return ResponseUtil.error(
          res,
          "Please enter a valid email address",
          400,
        );
      }

      // Validate mobile if provided
      if (req.body.mobile && !req.body.mobile.match(/^[6-9]\d{9}$/)) {
        return ResponseUtil.error(
          res,
          "Please enter a valid 10-digit mobile number",
          400,
        );
      }

      await DealerService.updateDealer(req.tenantId, id, req.body);

      const dealer = await DealerService.getDealerById(req.tenantId, id);

      return ResponseUtil.success(res, dealer, "Dealer updated successfully");
    } catch (error) {
      logger.error("Update dealer error:", error);

      if (error.message === "Dealer not found") {
        return ResponseUtil.notFound(res, error.message);
      }

      if (error.message === "Email already exists") {
        return ResponseUtil.error(res, error.message, 400);
      }

      return ResponseUtil.error(res, error.message, 400);
    }
  }

  async deleteDealer(req, res) {
    try {
      const id = Number(req.params.id);

      if (!id || isNaN(id)) {
        return ResponseUtil.error(res, "Invalid dealer ID", 400);
      }

      await DealerService.deleteDealer(req.tenantId, id);

      return ResponseUtil.success(res, null, "Dealer deleted successfully");
    } catch (error) {
      logger.error("Delete dealer error:", error);

      if (error.message.includes("Cannot delete dealer with existing orders")) {
        return ResponseUtil.error(res, error.message, 400);
      }

      return ResponseUtil.error(res, error.message, 400);
    }
  }

  // Optional: Get dealer statistics (like customer stats)
  async getDealerStats(req, res) {
    try {
      const stats = await DealerService.getDealerStats(req.tenantId);
      return ResponseUtil.success(
        res,
        stats,
        "Dealer stats fetched successfully",
      );
    } catch (error) {
      logger.error("Get dealer stats error:", error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  // Optional: Get dealers by type
  async getDealersByType(req, res) {
    try {
      const { dealerType } = req.params;
      const filters = {
        dealerType: dealerType,
        page: req.query.page,
        limit: req.query.limit,
      };

      const result = await DealerService.getAllDealers(req.tenantId, filters);

      return ResponseUtil.success(
        res,
        result,
        "Dealers fetched successfully by type",
      );
    } catch (error) {
      logger.error("Get dealers by type error:", error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  // Optional: Search dealers
  async searchDealers(req, res) {
    try {
      const { q } = req.query;
      const filters = {
        search: q,
        page: req.query.page,
        limit: req.query.limit,
      };

      const result = await DealerService.getAllDealers(req.tenantId, filters);

      return ResponseUtil.success(res, result, "Dealers searched successfully");
    } catch (error) {
      logger.error("Search dealers error:", error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }
}

module.exports = new DealerController();
