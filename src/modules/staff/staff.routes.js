const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const StaffController = require("./staff.controller");
const AuthMiddleware = require("../../middlewares/auth.middleware");
const TenantMiddleware = require("../../middlewares/tenant.middleware");

// Ensure upload directories exist
const uploadDir = path.join(__dirname, "../../../uploads/staff");
const tempDir = path.join(__dirname, "../../../uploads/temp");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "staff-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase(),
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed (jpeg, jpg, png, gif, webp)"));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter,
});

// Apply middleware
router.use(AuthMiddleware.authenticate);
router.use(TenantMiddleware.setTenantContext);
router.use(TenantMiddleware.cleanupTenantDb);

// Staff routes
router.post("/", upload.single("profile_image"), StaffController.createStaff);
router.put("/:id", upload.single("profile_image"), StaffController.updateStaff); // ADD THIS - for form-data with image
router.get("/", StaffController.getAllStaff);
router.get("/statistics", StaffController.getStaffStatistics);
router.get("/departments", StaffController.getAllDepartments);
router.get("/by-role/:roleId", StaffController.getStaffByRole);
router.get("/by-department/:department", StaffController.getStaffByDepartment);
router.get("/:id", StaffController.getStaffById);
router.get("/:id/activity", StaffController.getStaffActivity);
router.delete("/:id", StaffController.deleteStaff);
router.patch("/:id/reset-password", StaffController.resetPassword);
// Get staff by email
router.get("/email/:email", StaffController.getStaffByEmail);

module.exports = router;
