const express = require("express");
const router = express.Router();
const AuthController = require("./auth.controller");
const AuthValidation = require("./auth.validation");
const ValidateMiddleware = require("../../middlewares/validate.middleware");
const AuthMiddleware = require("../../middlewares/auth.middleware");
const upload = require("../../middlewares/upload.middleware");

// Public routes (no authentication)
router.post(
  "/login",
  ValidateMiddleware.validate(AuthValidation.login()),
  AuthController.login,
);

router.post("/forgot-password", AuthController.forgotPassword);
router.post("/verify-otp", AuthController.verifyOTP);
router.post("/reset-password", AuthController.resetPassword);

// Protected routes (require authentication)
router.use(AuthMiddleware.authenticate);

router.put(
  "/profile",
  AuthMiddleware.authenticate, // ✅ Authentication FIRST
  upload.single("profile_image"), // ✅ Then multer
  AuthController.updateProfile,
); // router.put(
//   "/profile",
//   ValidateMiddleware.validate(AuthValidation.updateProfile()), // ← Add validation
//   AuthController.updateProfile,
// );
// IMPORTANT: Use upload.single() for FormData support
router.put(
  "/profile",
  upload.single("profile_image"),
  AuthController.updateProfile,
);

router.get("/profile", AuthMiddleware.authenticate, AuthController.getProfile);


// Temporarily disable validation for testing
// router.post("/change-password", AuthController.changePassword);
router.post(
  "/change-password",
  ValidateMiddleware.validate(AuthValidation.changePassword()),
  AuthController.changePassword,
);
router.post("/logout", AuthController.logout);

module.exports = router;
