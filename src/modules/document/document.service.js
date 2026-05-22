const DatabaseManager = require("../../services/database-manager.service"); // Fixed path
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

class DocumentService {
  // Generate document code
  static async generateDocumentCode(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [result] = await db.query(
        "SELECT COUNT(*) as count FROM documents WHERE DATE(uploaded_at) = CURDATE()",
      );
      const count = result[0].count + 1;
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `DOC${year}${month}${day}${String(count).padStart(4, "0")}`;
    } finally {
      await db.end();
    }
  }

  // Save file to disk
  static async saveFile(file, documentCode, tenantId) {
    const uploadDir = path.join(__dirname, "../../../uploads/documents");

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const filename = `${documentCode}_${timestamp}${ext}`;
    const filepath = path.join(uploadDir, filename);

    // Move file to uploads directory
    fs.renameSync(file.path, filepath);

    return {
      filename: file.originalname,
      filepath: `/uploads/documents/${filename}`,
      size: (file.size / (1024 * 1024)).toFixed(2) + " MB",
      type: file.mimetype,
    };
  }

  // Upload document
  static async uploadDocument(documentData, file, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const documentCode = await this.generateDocumentCode(tenantId);

      // Save file
      const fileInfo = await this.saveFile(file, documentCode, tenantId);

      // Insert document record
      const [result] = await db.query(
        `INSERT INTO documents (
                    document_code, document_name, document_type, entity_type, entity_id,
                    file_name, file_path, file_size, file_type, description,
                    expiry_date, status, uploaded_by, uploaded_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          documentCode,
          documentData.document_name,
          documentData.document_type,
          documentData.entity_type,
          documentData.entity_id,
          fileInfo.filename,
          fileInfo.filepath,
          fileInfo.size,
          fileInfo.type,
          documentData.description || null,
          documentData.expiry_date || null,
          "active",
          documentData.uploaded_by,
        ],
      );

      return result.insertId;
    } finally {
      await db.end();
    }
  }

  // Get document by ID
  static async getDocumentById(id, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [rows] = await db.query(
        `SELECT d.*, u.name as uploaded_by_name
                FROM documents d
                LEFT JOIN users u ON d.uploaded_by = u.id
                WHERE d.id = ? AND d.deleted_at IS NULL`,
        [id],
      );
      return rows[0];
    } finally {
      await db.end();
    }
  }

  // Get documents by entity (customer/dealer/staff)
  static async getDocumentsByEntity(entityType, entityId, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [rows] = await db.query(
        `SELECT d.*, u.name as uploaded_by_name
                FROM documents d
                LEFT JOIN users u ON d.uploaded_by = u.id
                WHERE d.entity_type = ? AND d.entity_id = ? 
                AND d.deleted_at IS NULL AND d.status = 'active'
                ORDER BY d.uploaded_at DESC`,
        [entityType, entityId],
      );
      return rows;
    } finally {
      await db.end();
    }
  }

  // Get all documents with filters
  static async getAllDocuments(tenantId, filters = {}, pagination = {}) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      let query = `
                SELECT d.*, u.name as uploaded_by_name
                FROM documents d
                LEFT JOIN users u ON d.uploaded_by = u.id
                WHERE d.deleted_at IS NULL
            `;
      const params = [];

      if (filters.entity_type) {
        query += " AND d.entity_type = ?";
        params.push(filters.entity_type);
      }

      if (filters.entity_id) {
        query += " AND d.entity_id = ?";
        params.push(filters.entity_id);
      }

      if (filters.document_type) {
        query += " AND d.document_type = ?";
        params.push(filters.document_type);
      }

      if (filters.status) {
        query += " AND d.status = ?";
        params.push(filters.status);
      }

      if (filters.search) {
        query += " AND (d.document_name LIKE ? OR d.document_code LIKE ?)";
        params.push(`%${filters.search}%`, `%${filters.search}%`);
      }

      query += " ORDER BY d.uploaded_at ASC";

      const page = pagination.page || 1;
      const limit = pagination.limit || 10;
      const offset = (page - 1) * limit;

      query += " LIMIT ? OFFSET ?";
      params.push(parseInt(limit), parseInt(offset));

      const [rows] = await db.query(query, params);

      const [countResult] = await db.query(
        "SELECT COUNT(*) as total FROM documents WHERE deleted_at IS NULL",
      );

      return {
        data: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total,
          totalPages: Math.ceil(countResult[0].total / limit),
        },
      };
    } finally {
      await db.end();
    }
  }

  // Update document
  static async updateDocument(id, tenantId, updateData, file = null) {
    if (!id || isNaN(id)) {
      throw new Error("Invalid document ID");
    }

    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      // Check if document exists and get old file path
      const [existing] = await db.query(
        "SELECT id, file_path, document_code FROM documents WHERE id = ? AND deleted_at IS NULL",
        [id],
      );

      if (existing.length === 0) {
        throw new Error("Document not found");
      }

      const fields = [];
      const values = [];

      // Allowed text fields for update
      const allowedFields = [
        "document_name",
        "document_type",
        "entity_type",
        "entity_id",
        "description",
        "expiry_date",
        "status",
        "uploaded_by",
      ];

      for (const field of allowedFields) {
        if (updateData[field] !== undefined && updateData[field] !== "") {
          fields.push(`${field} = ?`);
          values.push(updateData[field]);
        }
      }

      // Handle file update if new file is provided
      if (file) {
        // Delete old file
        const oldFilePath = path.join(
          __dirname,
          "../../..",
          existing[0].file_path,
        );
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
          console.log("Old file deleted:", oldFilePath);
        }

        // Save new file
        const documentCode = existing[0].document_code;
        const fileInfo = await this.saveFile(file, documentCode, tenantId);

        fields.push(`file_name = ?`);
        fields.push(`file_path = ?`);
        fields.push(`file_size = ?`);
        fields.push(`file_type = ?`);

        values.push(fileInfo.filename);
        values.push(fileInfo.filepath);
        values.push(fileInfo.size);
        values.push(fileInfo.type);
      }

      if (fields.length === 0) {
        throw new Error("No fields to update");
      }

      fields.push("updated_at = NOW()");
      values.push(id);

      const query = `UPDATE documents SET ${fields.join(", ")} WHERE id = ? AND deleted_at IS NULL`;
      console.log("Update query:", query);
      console.log("Values:", values);

      const [result] = await db.query(query, values);

      if (result.affectedRows === 0) {
        throw new Error("Failed to update document");
      }

      // Get updated document
      const [updatedDocument] = await db.query(
        `SELECT d.*, u.name as uploaded_by_name
            FROM documents d
            LEFT JOIN users u ON d.uploaded_by = u.id
            WHERE d.id = ? AND d.deleted_at IS NULL`,
        [id],
      );

      return updatedDocument[0];
    } catch (error) {
      console.error("Update document error:", error);
      throw error;
    } finally {
      await db.end();
    }
  }
  // Delete document (soft delete)
  static async deleteDocument(tenantId, id) {
    if (!id || isNaN(id)) {
      throw new Error("Invalid document ID");
    }

    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      // Get file path to delete physical file
      const [document] = await db.query(
        "SELECT file_path FROM documents WHERE id = ?",
        [Number(id)],
      );

      if (document[0] && document[0].file_path) {
        const filePath = path.join(
          __dirname,
          "../../..",
          document[0].file_path,
        );
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // Soft delete record
      await db.query("UPDATE documents SET deleted_at = NOW() WHERE id = ?", [
        Number(id),
      ]);

      return true;
    } finally {
      await db.end();
    }
  }

  // Get document categories
  static async getDocumentCategories(entityType, tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [rows] = await db.query(
        `SELECT * FROM document_categories 
                WHERE entity_type = ? OR entity_type = 'all'
                ORDER BY sort_order`,
        [entityType],
      );
      return rows;
    } finally {
      await db.end();
    }
  }

  // Get document statistics
  static async getDocumentStats(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [stats] = await db.query(`
                SELECT 
                    COUNT(*) as total_documents,
                    SUM(CASE WHEN entity_type = 'customer' THEN 1 ELSE 0 END) as customer_documents,
                    SUM(CASE WHEN entity_type = 'dealer' THEN 1 ELSE 0 END) as dealer_documents,
                    SUM(CASE WHEN entity_type = 'staff' THEN 1 ELSE 0 END) as staff_documents,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_documents,
                    SUM(CASE WHEN expiry_date < CURDATE() THEN 1 ELSE 0 END) as expired_documents
                FROM documents
                WHERE deleted_at IS NULL
            `);
      return stats[0];
    } finally {
      await db.end();
    }
  }
}

module.exports = DocumentService;
