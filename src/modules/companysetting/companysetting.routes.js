const express = require("express");
const router = express.Router();
 
const CompanySettingController = require("./companysetting.controller");
const AuthMiddleware = require("../../middlewares/auth.middleware");
const TenantMiddleware = require("../../middlewares/tenant.middleware");
 
// Apply authentication and tenant middleware
router.use(AuthMiddleware.authenticate);
router.use(TenantMiddleware.setTenantContext);
router.use(TenantMiddleware.cleanupTenantDb);
 
// GET company setting
router.get("/", CompanySettingController.getCompanySetting);
 
// UPDATE company setting
router.put("/", CompanySettingController.updateCompanySetting);
 
module.exports = router;
 