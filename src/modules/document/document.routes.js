const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const DocumentController = require("./document.controller");
const AuthMiddleware = require("../../middlewares/auth.middleware");
const TenantMiddleware = require("../../middlewares/tenant.middleware");

// Ensure upload directories exist
const uploadDir = path.join(__dirname, "../../../uploads/documents");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "doc-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase(),
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error("Only images, PDF, and Office documents are allowed"));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilter,
});

// Apply middleware
router.use(AuthMiddleware.authenticate);
router.use(TenantMiddleware.setTenantContext);
router.use(TenantMiddleware.cleanupTenantDb);

// Document routes - NOTE: field name must be 'file'
router.post("/", upload.single("file"), DocumentController.uploadDocument);
router.get("/", DocumentController.getAllDocuments);
router.get("/statistics", DocumentController.getDocumentStatistics);
router.get("/categories/:entityType", DocumentController.getDocumentCategories);
router.get(
  "/entity/:entityType/:entityId",
  DocumentController.getDocumentsByEntity,
);
router.get("/:id", DocumentController.getDocumentById);
router.get("/:id/download", DocumentController.downloadDocument);
router.put("/:id", upload.single("file"), DocumentController.updateDocument); // Added file support
router.delete("/:id", DocumentController.deleteDocument);

module.exports = router;
