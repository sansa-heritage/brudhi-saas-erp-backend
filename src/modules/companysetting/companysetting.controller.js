const CompanySettingService = require("./companysetting.service");

class CompanySettingController {
  async getCompanySetting(req, res) {
    try {
      const tenantId =
        req.tenantId || req.user?.tenantId || req.headers["x-tenant-id"];

      console.log("Get company setting - Tenant ID:", tenantId);

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: "Tenant ID is required",
        });
      }

      const result = await CompanySettingService.getCompanySetting(tenantId);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Get company setting error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch company settings",
      });
    }
  }

  async updateCompanySetting(req, res) {
    try {
      const tenantId =
        req.tenantId || req.user?.tenantId || req.headers["x-tenant-id"];

      console.log("Update company setting - Tenant ID:", tenantId);
      console.log("Request body:", JSON.stringify(req.body, null, 2));

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: "Tenant ID is required",
        });
      }

      const result = await CompanySettingService.updateCompanySetting(
        tenantId,
        req.body,
      );

      return res.status(200).json({
        success: true,
        message: "Company setting updated successfully",
        data: result,
      });
    } catch (error) {
      console.error("Update company setting error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to update company settings",
      });
    }
  }
}

module.exports = new CompanySettingController();
