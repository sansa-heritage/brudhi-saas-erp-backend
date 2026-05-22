const DocumentService = require("./document.service");
const ResponseUtil = require("../../utils/response");
const logger = require("../../config/logger");
const fs = require("fs");
const path = require("path");

class DocumentController {
  // Upload document
  async uploadDocument(req, res) {
    try {
      const tenantId = req.user.tenant_id;

      if (!req.file) {
        return ResponseUtil.error(res, "No file uploaded", 400);
      }

      const documentData = {
        ...req.body,
        uploaded_by: req.user.id,
      };

      const documentId = await DocumentService.uploadDocument(
        documentData,
        req.file,
        tenantId,
      );
      const document = await DocumentService.getDocumentById(
        documentId,
        tenantId,
      );

      return ResponseUtil.success(
        res,
        document,
        "Document uploaded successfully",
        201,
      );
    } catch (error) {
      console.error("Upload document error:", error);
      return ResponseUtil.error(
        res,
        "Failed to upload document",
        500,
        error.message,
      );
    }
  }

  // Get document by ID
  async getDocumentById(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;

      const document = await DocumentService.getDocumentById(id, tenantId);

      if (!document) {
        return ResponseUtil.notFound(res, "Document not found");
      }

      return ResponseUtil.success(
        res,
        document,
        "Document retrieved successfully",
      );
    } catch (error) {
      console.error("Get document error:", error);
      return ResponseUtil.error(
        res,
        "Failed to retrieve document",
        500,
        error.message,
      );
    }
  }

  // Download document
  async downloadDocument(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;

      const document = await DocumentService.getDocumentById(id, tenantId);

      if (!document) {
        return ResponseUtil.notFound(res, "Document not found");
      }

      const filePath = path.join(__dirname, "../../..", document.file_path);

      if (!fs.existsSync(filePath)) {
        return ResponseUtil.error(res, "File not found", 404);
      }

      res.download(filePath, document.file_name);
    } catch (error) {
      console.error("Download document error:", error);
      return ResponseUtil.error(
        res,
        "Failed to download document",
        500,
        error.message,
      );
    }
  }

  // Get documents by entity
  async getDocumentsByEntity(req, res) {
    try {
      const { entityType, entityId } = req.params;
      const tenantId = req.user.tenant_id;

      const documents = await DocumentService.getDocumentsByEntity(
        entityType,
        entityId,
        tenantId,
      );

      return ResponseUtil.success(
        res,
        documents,
        "Documents retrieved successfully",
      );
    } catch (error) {
      console.error("Get documents by entity error:", error);
      return ResponseUtil.error(
        res,
        "Failed to retrieve documents",
        500,
        error.message,
      );
    }
  }

  // Get all documents
  async getAllDocuments(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const {
        page = 1,
        limit = 10,
        entity_type,
        entity_id,
        document_type,
        status,
        search,
      } = req.query;

      const filters = { entity_type, entity_id, document_type, status, search };
      const result = await DocumentService.getAllDocuments(tenantId, filters, {
        page,
        limit,
      });
      const stats = await DocumentService.getDocumentStats(tenantId);

      return ResponseUtil.success(
        res,
        {
          documents: result.data,
          pagination: result.pagination,
          statistics: stats,
        },
        "Documents retrieved successfully",
      );
    } catch (error) {
      console.error("Get all documents error:", error);
      return ResponseUtil.error(
        res,
        "Failed to retrieve documents",
        500,
        error.message,
      );
    }
  }

  // Update document
  async updateDocument(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;

      console.log("Update document ID:", id);
      console.log("Update data:", req.body);
      console.log("Update file:", req.file ? req.file.originalname : "No file");

      // Get text data from body
      const updateData = req.body;

      // Get file if uploaded
      const file = req.file || null;

      const updatedDocument = await DocumentService.updateDocument(
        id,
        tenantId,
        updateData,
        file,
      );

      return ResponseUtil.success(
        res,
        updatedDocument,
        "Document updated successfully",
      );
    } catch (error) {
      console.error("Update document error:", error);
      return ResponseUtil.error(
        res,
        error.message || "Failed to update document",
        500,
      );
    }
  }
  // Delete document
  async deleteDocument(req, res) {
    try {
      const id = Number(req.params.id);

      if (!id || isNaN(id)) {
        return ResponseUtil.error(res, "Invalid document ID", 400);
      }

      await DocumentService.deleteDocument(req.tenantId, id);

      return ResponseUtil.success(res, null, "Document deleted successfully");
    } catch (error) {
      logger.error("Delete document error:", error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  // Get document categories
  async getDocumentCategories(req, res) {
    try {
      const { entityType } = req.params;
      const tenantId = req.user.tenant_id;

      const categories = await DocumentService.getDocumentCategories(
        entityType,
        tenantId,
      );

      return ResponseUtil.success(
        res,
        categories,
        "Document categories retrieved successfully",
      );
    } catch (error) {
      console.error("Get document categories error:", error);
      return ResponseUtil.error(
        res,
        "Failed to retrieve categories",
        500,
        error.message,
      );
    }
  }

  // Get document statistics
  async getDocumentStatistics(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const stats = await DocumentService.getDocumentStats(tenantId);

      return ResponseUtil.success(
        res,
        stats,
        "Document statistics retrieved successfully",
      );
    } catch (error) {
      console.error("Get document statistics error:", error);
      return ResponseUtil.error(
        res,
        "Failed to retrieve statistics",
        500,
        error.message,
      );
    }
  }
}

module.exports = new DocumentController();
