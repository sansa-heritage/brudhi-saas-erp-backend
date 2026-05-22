const express = require("express");
const router = express.Router();
const CountryController = require("./country.controller");
const AuthMiddleware = require("../../middlewares/auth.middleware");

// Public routes
router.get("/", CountryController.getAllCountries);
router.get("/dropdown", CountryController.getAllCountries);
router.get("/:id", CountryController.getCountryById);

// Protected routes (require authentication for write operations)
router.use(AuthMiddleware.authenticate);
router.post("/", CountryController.createCountry);
router.put("/:id", CountryController.updateCountry);
router.delete("/:id", CountryController.deleteCountry);
// ✅ Toggle status route - FIXED: changed countryController to CountryController
router.patch("/toggle-status/:id", CountryController.toggleStatus);
module.exports = router;
