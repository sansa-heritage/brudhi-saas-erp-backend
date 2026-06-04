// const express = require("express");
// const router = express.Router();
// const multer = require("multer");
// const path = require("path");
// const fs = require("fs");
// const StaffController = require("./staff.controller");
// const AuthMiddleware = require("../../middlewares/auth.middleware");
// const TenantMiddleware = require("../../middlewares/tenant.middleware");

// // Ensure upload directories exist
// const uploadDir = path.join(__dirname, "../../../uploads/staff");
// const tempDir = path.join(__dirname, "../../../uploads/temp");

// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir, { recursive: true });
// }
// if (!fs.existsSync(tempDir)) {
//   fs.mkdirSync(tempDir, { recursive: true });
// }

// // Configure multer for file upload
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, tempDir);
//   },
//   filename: function (req, file, cb) {
//     const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
//     cb(null, "staff-" + uniqueSuffix + path.extname(file.originalname));
//   },
// });

// const fileFilter = (req, file, cb) => {
//   const allowedTypes = /jpeg|jpg|png|gif|webp/;
//   const extname = allowedTypes.test(
//     path.extname(file.originalname).toLowerCase(),
//   );
//   const mimetype = allowedTypes.test(file.mimetype);

//   if (mimetype && extname) {
//     cb(null, true);
//   } else {
//     cb(new Error("Only image files are allowed (jpeg, jpg, png, gif, webp)"));
//   }
// };

// const upload = multer({
//   storage: storage,
//   limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
//   fileFilter: fileFilter,
// });

// // Apply middleware
// router.use(AuthMiddleware.authenticate);
// router.use(TenantMiddleware.setTenantContext);
// router.use(TenantMiddleware.cleanupTenantDb);

// // Staff routes
// router.post("/", upload.single("profile_image"), StaffController.createStaff);
// router.put("/:id", upload.single("profile_image"), StaffController.updateStaff); // ADD THIS - for form-data with image
// router.get("/", StaffController.getAllStaff);
// router.get("/statistics", StaffController.getStaffStatistics);
// router.get("/departments", StaffController.getAllDepartments);
// router.get("/by-role/:roleId", StaffController.getStaffByRole);
// router.get("/by-department/:department", StaffController.getStaffByDepartment);
// router.get("/:id", StaffController.getStaffById);
// router.get("/:id/activity", StaffController.getStaffActivity);
// router.delete("/:id", StaffController.deleteStaff);
// router.patch("/:id/reset-password", StaffController.resetPassword);
// // Get staff by email
// router.get("/email/:email", StaffController.getStaffByEmail);
// // ============ SALARY STRUCTURE ============
// router.post("/salary-structure", StaffController.createSalaryStructure);
// router.get("/salary-structure/:staffId", StaffController.getSalaryStructure);
// router.get("/salary-structure", StaffController.getAllSalaryStructures);

// // ============ PAYROLL ============
// router.post("/payroll/generate", StaffController.generatePayroll); // ✅ CORRECT - "router"
// router.get("/payroll", StaffController.getAllPayrolls);
// router.get("/payroll/:id", StaffController.getPayrollById); // ✅ This exists
// router.patch("/payroll/:id/payment", StaffController.processPayrollPayment); // ✅ This exists
// // ============ LEAVE REQUESTS ============
// // Mark leave as taken
// router.patch(
//   "/leave-requests/:id/mark-taken",
//   StaffController.markLeaveAsTaken,
// );

// // Auto-mark all expired leaves
// router.post(
//   "/leave-requests/auto-mark-expired",
//   StaffController.autoMarkExpiredLeaves,
// );
// // ============ OVERTIME REQUESTS ============
// router.post("/overtime", StaffController.createOvertimeRequest);
// router.get("/overtime", StaffController.getOvertimeRequests);
// router.patch("/overtime/:id/status", StaffController.updateOvertimeStatus);

// // ============ BONUSES ============
// router.post("/bonuses", StaffController.createBonus);
// router.get("/bonuses", StaffController.getBonuses);
// router.patch("/bonuses/:id/status", StaffController.updateBonusStatus);

// // ============ STAFF TARGETS ============
// router.post("/targets", StaffController.createStaffTarget);
// router.get("/targets", StaffController.getStaffTargets);
// router.patch(
//   "/targets/:id/achievement",
//   StaffController.updateTargetAchievement,
// );

// // ============ DASHBOARD ============
// router.get("/dashboard/stats", StaffController.getStaffDashboardStats);

// module.exports = router;

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
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: fileFilter,
});

// Apply middleware
router.use(AuthMiddleware.authenticate);
router.use(TenantMiddleware.setTenantContext);
router.use(TenantMiddleware.cleanupTenantDb);

// ============================================
// SPECIFIC ROUTES (NO :id PARAMETER) - MUST COME FIRST
// ============================================

// Staff CRUD - specific paths
router.post("/", upload.single("profile_image"), StaffController.createStaff);
router.get("/", StaffController.getAllStaff);
router.put("/:id", upload.single("profile_image"), StaffController.updateStaff);

// Statistics and lists
router.get("/statistics", StaffController.getStaffStatistics);
router.get("/departments", StaffController.getAllDepartments);
router.get("/dashboard/stats", StaffController.getStaffDashboardStats);

// Lookup routes (specific paths)
router.get("/by-role/:roleId", StaffController.getStaffByRole);
router.get("/by-department/:department", StaffController.getStaffByDepartment);
router.get("/email/:email", StaffController.getStaffByEmail);

// ============================================
// PAYROLL ROUTES - MUST COME BEFORE /:id
// ============================================
router.post("/payroll/generate", StaffController.generatePayroll);
router.get("/payroll", StaffController.getAllPayrolls);
router.get("/payroll/:id", StaffController.getPayrollById);
router.patch("/payroll/:id/payment", StaffController.processPayrollPayment);

// ============ PAYSLIP DOWNLOAD ROUTES ============
router.get("/payroll/:id/download/excel", StaffController.downloadExcelPayslip);
router.get("/payroll/:id/download/pdf", StaffController.downloadPDFPayslip);
router.get("/payroll/:id/view/pdf", StaffController.viewPDFPayslip);

// ============================================
// SALARY STRUCTURE ROUTES
// ============================================
router.post("/salary-structure", StaffController.createSalaryStructure);
router.get("/salary-structure/:staffId", StaffController.getSalaryStructure);
router.get("/salary-structure", StaffController.getAllSalaryStructures);

// ============ LEAVE MANAGEMENT ROUTES ============
router.post("/mark-leave", StaffController.markLeaveDirectly);
router.get("/leave-history/:staff_id?", StaffController.getStaffLeaveHistory);
router.get("/leave-summary", StaffController.getLeaveSummary);

// ============================================
// OVERTIME REQUEST ROUTES
// ============================================
router.post("/overtime", StaffController.createOvertimeRequest);
router.get("/overtime", StaffController.getOvertimeRequests);
router.patch("/overtime/:id/status", StaffController.updateOvertimeStatus);
router.get("/overtime/:id", StaffController.getOvertimeRequestById);

// In your staff.routes.js or overtime.routes.js

// Delete overtime request
router.delete("/overtime/:id", StaffController.deleteOvertimeRequest);

// ============================================
// BONUS ROUTES
// ============================================
router.post("/bonuses", StaffController.createBonus);
router.get("/bonuses", StaffController.getBonuses);
router.patch("/bonuses/:id/status", StaffController.updateBonusStatus);
router.put("/bonuses/:id", StaffController.updateBonus); // ✅ Add this - Update bonus
router.delete("/bonuses/:id", StaffController.deleteBonus); // ✅ Add this - Delete bonus
router.get("/bonuses/:id", StaffController.getBonusById); // ✅ ADD THIS

// ============================================
// STAFF TARGET ROUTES
// ============================================
router.post("/targets", StaffController.createStaffTarget);
router.get("/targets", StaffController.getStaffTargets);
router.patch(
  "/targets/:id/achievement",
  StaffController.updateTargetAchievement,
);
router.delete("/targets/:id", StaffController.deleteStaffTargets); // ✅ Add this - Delete bonus

// ============================================
// GENERIC :id ROUTES - MUST COME ABSOLUTELY LAST
// ============================================
router.get("/:id/activity", StaffController.getStaffActivity);
router.patch("/:id/reset-password", StaffController.resetPassword);
router.delete("/:id", StaffController.deleteStaff);
router.get("/:id", StaffController.getStaffById); // THIS MUST BE THE VERY LAST ROUTE

console.log("✅ Staff routes loaded in correct order");
console.log("   - GET    /api/staff/payroll - Should work now");

module.exports = router;
