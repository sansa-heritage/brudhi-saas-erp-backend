const CountryService = require("./country.service");
const ResponseUtil = require("../../utils/response");
const logger = require("../../config/logger");

class CountryController {
  async getAllCountries(req, res) {
    try {
      const filters = {
        status: req.query.status,
        search: req.query.search,
        page: req.query.page,
        limit: req.query.limit,
      };

      const result = await CountryService.getAllCountries(filters);
      return ResponseUtil.success(
        res,
        result,
        "Countries fetched successfully",
      );
    } catch (error) {
      logger.error("Get all countries error:", error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  async getCountryById(req, res) {
    try {
      const country = await CountryService.getCountryById(req.params.id);
      if (!country) {
        return ResponseUtil.notFound(res, "Country not found");
      }
      return ResponseUtil.success(res, country, "Country fetched successfully");
    } catch (error) {
      logger.error("Get country by id error:", error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  async createCountry(req, res) {
    try {
      const countryId = await CountryService.createCountry(req.body);
      const country = await CountryService.getCountryById(countryId);
      return ResponseUtil.created(res, country, "Country created successfully");
    } catch (error) {
      logger.error("Create country error:", error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  async updateCountry(req, res) {
    try {
      await CountryService.updateCountry(req.params.id, req.body);
      const country = await CountryService.getCountryById(req.params.id);
      return ResponseUtil.success(res, country, "Country updated successfully");
    } catch (error) {
      logger.error("Update country error:", error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  async deleteCountry(req, res) {
    try {
      await CountryService.deleteCountry(req.params.id);
      return ResponseUtil.success(res, null, "Country deleted successfully");
    } catch (error) {
      logger.error("Delete country error:", error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  // Toggle Status
  async toggleStatus(req, res) {
    try {
      const updatedCountry = await CountryService.toggleStatus(req.params.id);
      const action = updatedCountry.status === 1 ? "activated" : "deactivated";
      return ResponseUtil.success(
        res,
        updatedCountry,
        `Country ${action} successfully`,
      );
    } catch (error) {
      logger.error("Toggle country status error:", error);
      if (error.message === "Country not found") {
        return ResponseUtil.notFound(res, error.message);
      }
      return ResponseUtil.error(res, error.message, 400);
    }
  }
}

module.exports = new CountryController();
