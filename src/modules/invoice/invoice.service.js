// src/modules/invoice/invoice.service.js

const DatabaseManager = require("../../services/database-manager.service");
const moment = require("moment");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const { Parser } = require("json2csv");
const fs = require("fs");
const path = require("path");

class InvoiceService {
  // ==============================================
  // INVOICE NUMBER GENERATION
  // ==============================================

  async generateInvoiceNumber(tenantId, db, type) {
    const prefix = type === "customer" ? "INV" : "DLR";
    const date = moment();
    const year = date.format("YYYY");
    const month = date.format("MM");
    const searchPattern = `${prefix}/${year}${month}/%`;

    try {
      const rows = await this._getLastInvoiceNumber(db, searchPattern);
      const sequence = this._getNextSequence(rows);
      const sequenceStr = String(sequence).padStart(4, "0");
      return `${prefix}/${year}${month}/${sequenceStr}`;
    } catch (error) {
      console.error("Error generating invoice number:", error);
      return `${prefix}/${year}${month}/${Date.now()}`;
    }
  }

  async _getLastInvoiceNumber(db, searchPattern) {
    const query = `
      SELECT invoice_no FROM invoices 
      WHERE invoice_no LIKE ? 
      ORDER BY id DESC LIMIT 1
    `;
    if (db.execute) {
      const [result] = await db.execute(query, [searchPattern]);
      return result;
    }
    return await db.query(query, [searchPattern]);
  }

  _getNextSequence(rows) {
    if (!rows?.length || !rows[0]?.invoice_no) return 1;
    const lastNumber = rows[0].invoice_no.split("/").pop();
    const parsedNumber = parseInt(lastNumber);
    return !isNaN(parsedNumber) ? parsedNumber + 1 : 1;
  }

  // ==============================================
  // GET COMPANY SETTINGS - FIXED VERSION
  // ==============================================

  async _getCompanySettings(tenantId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      console.log("Fetching company settings for tenant:", tenantId);

      // First, check if the table exists and get the first record
      const [settings] = await db.query(
        "SELECT * FROM company_settings LIMIT 1",
      );

      console.log("Raw settings from DB:", settings);

      if (settings && settings.length > 0) {
        const setting = settings[0];

        // Map the fields correctly based on your actual column names
        const mappedSettings = {
          company_name: setting.company_name || setting.companyName || null,
          company_address: setting.company_address || setting.address || null,
          company_phone: setting.company_phone || setting.phone || null,
          company_email: setting.company_email || setting.email || null,
          gst_number: setting.gst_number || setting.gst_no || null,
          bank_name: setting.bank_name || null,
          account_number: setting.account_number || null,
          ifsc_code: setting.ifsc_code || null,
          branch_name: setting.branch_name || null,
          upi_id: setting.upi_id || null,
          logo: setting.logo || null,
          logo_path: setting.logo_path || null,
          // Also keep original field names for compatibility
          address: setting.company_address || setting.address,
          phone: setting.company_phone || setting.phone,
          email: setting.company_email || setting.email,
          gst_no: setting.gst_number || setting.gst_no,
        };

        console.log(
          "Mapped settings - company_name:",
          mappedSettings.company_name,
        );
        console.log(
          "Mapped settings - address:",
          mappedSettings.company_address,
        );

        return mappedSettings;
      }

      console.log("No company settings found");
      return null;
    } catch (error) {
      console.error("Error fetching company settings:", error);
      return null;
    } finally {
      await db.end();
    }
  }

  async _getCompanyLogo(companySettings) {
    if (!companySettings) return null;

    // Check for logo in the settings object
    if (companySettings.logo && typeof companySettings.logo === "string") {
      return companySettings.logo;
    }

    // Check for logo path
    if (companySettings.logo_path && fs.existsSync(companySettings.logo_path)) {
      return companySettings.logo_path;
    }

    return null;
  }

  // ==============================================
  // CRUD OPERATIONS
  // ==============================================

  async getAllInvoices(tenantId, filters = {}) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const { query, params } = this._buildInvoiceQuery(filters);
      const page = Number(filters.page) || 1;
      const limit = Math.min(100, Number(filters.limit) || 10);
      const offset = (page - 1) * limit;

      const [invoices] = await db.query(query + " LIMIT ? OFFSET ?", [
        ...params,
        limit,
        offset,
      ]);
      const invoicesWithItems = await this._attachItemsToInvoices(db, invoices);
      const [countResult] = await db.query(
        "SELECT COUNT(*) as total FROM invoices",
      );
      const total = countResult[0]?.total || 0;

      return {
        data: invoicesWithItems,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } finally {
      await db.end();
    }
  }

  _buildInvoiceQuery(filters) {
    let query = `
      SELECT i.*, 
             CASE 
               WHEN i.party_type = 'customer' THEN c.name
               ELSE d.name
             END as party_name
      FROM invoices i
      LEFT JOIN customers c ON i.party_type = 'customer' AND i.party_id = c.id
      LEFT JOIN dealers d ON i.party_type = 'dealer' AND i.party_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.partyType) {
      query += " AND i.party_type = ?";
      params.push(filters.partyType);
    }
    if (filters.paymentStatus) {
      query += " AND i.payment_status = ?";
      params.push(filters.paymentStatus);
    }
    if (filters.fromDate) {
      query += " AND i.invoice_date >= ?";
      params.push(filters.fromDate);
    }
    if (filters.toDate) {
      query += " AND i.invoice_date <= ?";
      params.push(filters.toDate);
    }

    query += " ORDER BY i.created_at ASC";
    return { query, params };
  }

  async _attachItemsToInvoices(db, invoices) {
    const invoicesWithItems = [];
    for (const invoice of invoices) {
      const [items] = await db.query(
        `SELECT ii.*, ct.name as cylinder_type_name
         FROM invoice_items ii
         LEFT JOIN cylinder_types ct ON ii.cylinder_type_id = ct.id
         WHERE ii.invoice_id = ?`,
        [invoice.id],
      );
      invoicesWithItems.push({
        ...invoice,
        items,
        item_count: items.length,
      });
    }
    return invoicesWithItems;
  }

  async getInvoiceById(tenantId, id) {
    if (!id || isNaN(id)) throw new Error("Invalid invoice ID");

    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [invoices] = await db.query("SELECT * FROM invoices WHERE id = ?", [
        Number(id),
      ]);
      if (!invoices?.length) return null;

      const invoice = invoices[0];
      invoice.items = await this._getInvoiceItems(db, id);
      invoice.payments = await this._getInvoicePayments(db, id);

      invoice.shipping_address =
        invoice.shipping_address || invoice.party_address;
      invoice.shipping_gst = invoice.shipping_gst || invoice.party_gst;

      invoice.subtotal = Number(invoice.subtotal) || 0;
      invoice.gst_amount = Number(invoice.gst_amount) || 0;
      invoice.discount_amount = Number(invoice.discount_amount) || 0;
      invoice.net_amount = Number(invoice.net_amount) || 0;
      invoice.paid_amount = Number(invoice.paid_amount) || 0;
      invoice.balance_amount = Number(invoice.balance_amount) || 0;
      invoice.total_amount = Number(invoice.total_amount) || 0;

      if (invoice.items) {
        invoice.items.forEach((item) => {
          item.quantity = Number(item.quantity) || 0;
          item.rate = Number(item.rate) || 0;
          item.gst_percent = Number(item.gst_percent) || 0;
          item.discount_amount = Number(item.discount_amount) || 0;
        });
      }

      return invoice;
    } catch (error) {
      console.error("Error in getInvoiceById:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  async _getInvoiceItems(db, invoiceId) {
    const [items] = await db.query(
      `SELECT ii.*, ct.name as cylinder_name, ct.weight
       FROM invoice_items ii
       LEFT JOIN cylinder_types ct ON ii.cylinder_type_id = ct.id
       WHERE ii.invoice_id = ?`,
      [Number(invoiceId)],
    );

    if (items && items.length) {
      items.forEach((item) => {
        item.quantity = Number(item.quantity) || 0;
        item.rate = Number(item.rate) || 0;
        item.gst_percent = Number(item.gst_percent) || 0;
        item.discount_amount = Number(item.discount_amount) || 0;
      });
    }

    return items || [];
  }

  async _getInvoicePayments(db, invoiceId) {
    const [payments] = await db.query(
      "SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC",
      [Number(invoiceId)],
    );
    return payments || [];
  }

  async createInvoice(tenantId, invoiceData, items) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const calculations = this._calculateInvoiceTotals(items, invoiceData);
      const invoiceNo = await this.generateInvoiceNumber(
        tenantId,
        connection,
        invoiceData.partyType,
      );
      const invoiceId = await this._insertInvoice(
        connection,
        invoiceData,
        invoiceNo,
        calculations,
      );

      await this._insertInvoiceItems(connection, invoiceId, items);
      await this._updateStockQuantities(connection, items);

      await connection.commit();
      return invoiceId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  _calculateInvoiceTotals(items, invoiceData) {
    let subtotal = 0;
    let totalGst = 0;

    for (const item of items) {
      const quantity = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      const itemTotal = quantity * rate;
      const gstPercent = Number(item.gstPercent) || 5;
      const gstAmount = (itemTotal * gstPercent) / 100;

      subtotal += itemTotal;
      totalGst += gstAmount;
    }

    const discountAmount = this._calculateDiscount(subtotal, invoiceData);
    const taxableAmount = subtotal - discountAmount;
    const totalAmount = taxableAmount + totalGst;
    const roundOff = Number(invoiceData.roundOff) || 0;
    const netAmount = totalAmount + roundOff;
    const paidAmount = Number(invoiceData.paidAmount) || 0;
    const balanceAmount = netAmount - paidAmount;

    return {
      subtotal,
      totalGst,
      discountAmount,
      taxableAmount,
      totalAmount,
      roundOff,
      netAmount,
      paidAmount,
      balanceAmount,
    };
  }

  _calculateDiscount(subtotal, invoiceData) {
    const discountType = invoiceData.discountType || "fixed";
    const discountValue = Number(invoiceData.discountValue) || 0;
    if (discountType === "percentage") return (subtotal * discountValue) / 100;
    return discountValue;
  }

  async _insertInvoice(connection, invoiceData, invoiceNo, calculations) {
    const {
      subtotal,
      totalGst,
      discountAmount,
      taxableAmount,
      totalAmount,
      roundOff,
      netAmount,
      paidAmount,
      balanceAmount,
    } = calculations;

    const invoiceDate =
      invoiceData.invoiceDate || moment().format("YYYY-MM-DD");
    const dueDate =
      invoiceData.dueDate || moment().add(30, "days").format("YYYY-MM-DD");

    this._validateRequiredFields(invoiceData);

    const [result] = await connection.execute(
      `INSERT INTO invoices (
        invoice_no, invoice_date, due_date, party_type, party_id, party_name,
        party_gst, party_address, subtotal, discount_type, discount_value, 
        discount_amount, taxable_amount, gst_amount, total_amount,
        round_off, net_amount, payment_status, paid_amount, balance_amount,
        payment_method, transaction_id, notes, terms_conditions, created_by, 
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        invoiceNo,
        invoiceDate,
        dueDate,
        invoiceData.partyType,
        Number(invoiceData.partyId),
        invoiceData.partyName,
        invoiceData.partyGst || null,
        invoiceData.partyAddress || null,
        subtotal,
        invoiceData.discountType || "fixed",
        Number(invoiceData.discountValue) || 0,
        discountAmount,
        taxableAmount,
        totalGst,
        totalAmount,
        roundOff,
        netAmount,
        invoiceData.paymentStatus || "unpaid",
        paidAmount,
        balanceAmount,
        invoiceData.paymentMethod || null,
        invoiceData.transactionId || null,
        invoiceData.notes || null,
        invoiceData.termsConditions || null,
        Number(invoiceData.createdBy),
      ],
    );

    return result.insertId;
  }

  _validateRequiredFields(invoiceData) {
    if (!invoiceData.partyType) throw new Error("partyType is required");
    if (!invoiceData.partyId) throw new Error("partyId is required");
    if (!invoiceData.partyName) throw new Error("partyName is required");
    if (!invoiceData.createdBy) throw new Error("createdBy is required");
  }

  async _insertInvoiceItems(connection, invoiceId, items) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      this._validateInvoiceItem(item, i);
      const calculations = this._calculateItemTotals(item);

      await connection.execute(
        `INSERT INTO invoice_items (
          invoice_id, cylinder_type_id, quantity, rate, discount_percent,
          discount_amount, taxable_amount, gst_percent, gst_amount, total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceId,
          Number(item.cylinderTypeId),
          Number(item.quantity),
          Number(item.rate),
          Number(item.discountPercent) || 0,
          Number(item.discountAmount) || 0,
          calculations.taxableAmount,
          Number(item.gstPercent) || 5,
          calculations.gstAmount,
          calculations.totalAmount,
        ],
      );
    }
  }

  _validateInvoiceItem(item, index) {
    if (!item.cylinderTypeId)
      throw new Error(`cylinderTypeId required for item ${index + 1}`);
    if (Number(item.quantity) <= 0)
      throw new Error(`quantity must be > 0 for item ${index + 1}`);
    if (Number(item.rate) <= 0)
      throw new Error(`rate must be > 0 for item ${index + 1}`);
  }

  _calculateItemTotals(item) {
    const quantity = Number(item.quantity);
    const rate = Number(item.rate);
    const gstPercent = Number(item.gstPercent) || 5;
    const taxableAmount = quantity * rate;
    const gstAmount = (taxableAmount * gstPercent) / 100;
    const totalAmount =
      taxableAmount + gstAmount - (Number(item.discountAmount) || 0);
    return { taxableAmount, gstAmount, totalAmount };
  }

  async _updateStockQuantities(connection, items) {
    for (const item of items) {
      await connection.execute(
        `UPDATE gas_stocks 
         SET available_stock = available_stock - ?,
             updated_at = NOW()
         WHERE cylinder_type_id = ?`,
        [Number(item.quantity), Number(item.cylinderTypeId)],
      );
    }
  }

  async updateInvoice(tenantId, id, invoiceData) {
    if (!id || isNaN(id)) throw new Error("Invalid invoice ID");

    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();
      const currentInvoice = await this._getCurrentInvoice(connection, id);
      const updateFields = this._buildInvoiceUpdateFields(
        currentInvoice,
        invoiceData,
      );

      if (updateFields.updates.length > 0) {
        const query = `UPDATE invoices SET ${updateFields.updates.join(", ")} WHERE id = ?`;
        await connection.execute(query, [...updateFields.params, Number(id)]);
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async _getCurrentInvoice(connection, id) {
    const [invoices] = await connection.execute(
      "SELECT * FROM invoices WHERE id = ?",
      [Number(id)],
    );
    if (!invoices.length) throw new Error("Invoice not found");
    return invoices[0];
  }

  _buildInvoiceUpdateFields(currentInvoice, invoiceData) {
    const updates = [];
    const params = [];

    const discountAmount = this._recalculateDiscount(
      currentInvoice,
      invoiceData,
    );

    const fieldMapping = {
      party_name: invoiceData.partyName,
      party_gst: invoiceData.partyGst,
      party_address: invoiceData.partyAddress,
      invoice_date: invoiceData.invoiceDate,
      due_date: invoiceData.dueDate,
      discount_type: invoiceData.discountType,
      discount_value: invoiceData.discountValue,
      discount_amount: discountAmount,
      round_off:
        invoiceData.roundOff !== undefined
          ? Number(invoiceData.roundOff)
          : currentInvoice.round_off,
      payment_status: invoiceData.paymentStatus,
      payment_method: invoiceData.paymentMethod,
      transaction_id: invoiceData.transactionId,
      notes: invoiceData.notes,
      terms_conditions: invoiceData.termsConditions,
    };

    for (const [dbField, value] of Object.entries(fieldMapping)) {
      if (value !== undefined && value !== null && value !== "") {
        updates.push(`${dbField} = ?`);
        params.push(value);
      }
    }

    if (invoiceData.paidAmount !== undefined) {
      const paidAmount = Number(invoiceData.paidAmount);
      const netAmount = currentInvoice.net_amount;
      const balanceAmount = netAmount - paidAmount;
      updates.push("paid_amount = ?", "balance_amount = ?");
      params.push(paidAmount, balanceAmount);
    }

    if (updates.length > 0) {
      updates.push("updated_at = NOW()");
    }

    return { updates, params };
  }

  _recalculateDiscount(currentInvoice, invoiceData) {
    const subtotal = currentInvoice.subtotal;
    const discountType =
      invoiceData.discountType || currentInvoice.discount_type;
    const discountValue =
      invoiceData.discountValue !== undefined
        ? Number(invoiceData.discountValue)
        : currentInvoice.discount_value;

    if (discountType === "percentage") return (subtotal * discountValue) / 100;
    return discountValue;
  }

  async recordPayment(tenantId, paymentData) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();
      const invoice = await this._getInvoiceForPayment(
        connection,
        paymentData.invoiceId,
      );
      const { newPaidAmount, newBalanceAmount, paymentStatus } =
        this._calculatePaymentUpdate(invoice, paymentData.amount);

      await this._insertPaymentRecord(connection, paymentData);
      await this._updateInvoicePayment(
        connection,
        paymentData.invoiceId,
        newPaidAmount,
        newBalanceAmount,
        paymentStatus,
      );

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async _getInvoiceForPayment(connection, invoiceId) {
    const [invoice] = await connection.execute(
      "SELECT total_amount, paid_amount FROM invoices WHERE id = ?",
      [invoiceId],
    );
    if (!invoice?.length) throw new Error("Invoice not found");
    return invoice[0];
  }

  _calculatePaymentUpdate(invoice, paymentAmount) {
    const currentPaidAmount = invoice.paid_amount || 0;
    const newPaidAmount = currentPaidAmount + paymentAmount;
    const newBalanceAmount = invoice.total_amount - newPaidAmount;
    const paymentStatus =
      newPaidAmount >= invoice.total_amount ? "paid" : "partial";
    return { newPaidAmount, newBalanceAmount, paymentStatus };
  }

  async _insertPaymentRecord(connection, paymentData) {
    await connection.execute(
      `INSERT INTO payments (
        invoice_id, payment_date, amount, payment_method, 
        transaction_id, reference_no, notes, received_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        paymentData.invoiceId,
        paymentData.paymentDate || moment().format("YYYY-MM-DD"),
        paymentData.amount,
        paymentData.paymentMethod || "cash",
        paymentData.transactionId || null,
        paymentData.referenceNo || null,
        paymentData.notes || null,
        paymentData.receivedBy,
      ],
    );
  }

  async _updateInvoicePayment(
    connection,
    invoiceId,
    paidAmount,
    balanceAmount,
    paymentStatus,
  ) {
    await connection.execute(
      `UPDATE invoices 
       SET paid_amount = ?, balance_amount = ?, payment_status = ?, updated_at = NOW()
       WHERE id = ?`,
      [paidAmount, balanceAmount, paymentStatus, invoiceId],
    );
  }

  async deleteInvoice(tenantId, invoiceId) {
    if (!invoiceId || isNaN(invoiceId))
      throw new Error("Valid invoice ID is required");

    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [invoices] = await db.query("SELECT * FROM invoices WHERE id = ?", [
        Number(invoiceId),
      ]);
      if (!invoices?.length) throw new Error("Invoice not found");

      const invoice = invoices[0];
      if (invoice.payment_status === "paid")
        throw new Error("Cannot delete a paid invoice");

      await db.query("DELETE FROM invoice_items WHERE invoice_id = ?", [
        invoiceId,
      ]);
      await db.query("DELETE FROM payments WHERE invoice_id = ?", [invoiceId]);
      await db.query("DELETE FROM invoices WHERE id = ?", [invoiceId]);

      return {
        success: true,
        message: "Invoice deleted successfully",
        deletedInvoice: {
          id: invoice.id,
          invoice_no: invoice.invoice_no,
          net_amount: invoice.net_amount,
        },
      };
    } catch (error) {
      console.error("Delete invoice error:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  async updateInvoiceStatus(tenantId, invoiceId, status) {
    const validStatuses = ["paid", "unpaid", "partial", "cancelled"];
    if (!validStatuses.includes(status))
      throw new Error("Invalid payment status");

    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      await db.query(
        "UPDATE invoices SET payment_status = ?, updated_at = NOW() WHERE id = ?",
        [status, parseInt(invoiceId)],
      );
      return true;
    } finally {
      await db.end();
    }
  }

  async getInvoiceByNumber(tenantId, invoiceNo) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [invoices] = await db.query(
        "SELECT * FROM invoices WHERE invoice_no = ?",
        [invoiceNo],
      );
      return invoices[0] || null;
    } finally {
      await db.end();
    }
  }

  async getInvoiceSummary(tenantId, partyType, partyId) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    try {
      const [result] = await db.query(
        `SELECT 
          COUNT(*) as total_invoices,
          SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) as paid_amount,
          SUM(CASE WHEN payment_status = 'unpaid' THEN total_amount ELSE 0 END) as unpaid_amount,
          SUM(CASE WHEN payment_status = 'partial' THEN total_amount - paid_amount ELSE 0 END) as partial_amount,
          SUM(total_amount) as total_amount
         FROM invoices 
         WHERE party_type = ? AND party_id = ?`,
        [partyType, parseInt(partyId)],
      );
      return (
        result[0] || {
          total_invoices: 0,
          paid_amount: 0,
          unpaid_amount: 0,
          partial_amount: 0,
          total_amount: 0,
        }
      );
    } finally {
      await db.end();
    }
  }

  // ==============================================
  // INVOICE GENERATION FORMATS
  // ==============================================

  async generateInvoice(tenantId, invoiceId, format = "pdf") {
    const invoiceData = await this.getInvoiceById(tenantId, invoiceId);
    if (!invoiceData) throw new Error("Invoice not found");

    const companySettings = await this._getCompanySettings(tenantId);
    const logoSrc = await this._getCompanyLogo(companySettings);

    const formatHandlers = {
      pdf: () => this.generatePDF(invoiceData, companySettings, logoSrc),
      excel: () => this.generateExcel(invoiceData),
      csv: () => this.generateCSV(invoiceData),
      json: () => this.generateJSON(invoiceData),
    };

    const handler = formatHandlers[format.toLowerCase()];
    if (!handler)
      throw new Error(
        `Unsupported format: ${format}. Supported formats: pdf, excel, csv, json`,
      );
    return handler();
  }

  // ==============================================
  // BEAUTIFUL PDF GENERATION WITH COMPANY LOGO
  // ==============================================

  async generatePDF(invoiceData, companySettings = null, logoSrc = null) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: "A4" });
        const buffers = [];

        doc.on("data", buffers.push.bind(buffers));
        doc.on("end", () => resolve(Buffer.concat(buffers)));

        let currentY = 45;

        // ==============================================
        // HEADER SECTION WITH LOGO FROM COMPANY SETTINGS
        // ==============================================

        // Logo on Left
        if (logoSrc) {
          try {
            if (
              typeof logoSrc === "string" &&
              logoSrc.startsWith("data:image")
            ) {
              const base64Data = logoSrc.replace(
                /^data:image\/\w+;base64,/,
                "",
              );
              const imageBuffer = Buffer.from(base64Data, "base64");
              doc.image(imageBuffer, 50, currentY, { width: 80 });
            } else if (typeof logoSrc === "string" && fs.existsSync(logoSrc)) {
              doc.image(logoSrc, 50, currentY, { width: 80 });
            }
          } catch (err) {
            console.error("Error adding logo:", err);
          }
        }

        // Company Details on Right
        if (companySettings && companySettings.company_name) {
          doc
            .fontSize(16)
            .font("Helvetica-Bold")
            .text(
              companySettings.company_name || "GASFLOW ERP",
              150,
              currentY,
              { align: "right" },
            );
          doc.fontSize(8).font("Helvetica");
          let textY = currentY + 20;

          const address =
            companySettings.company_address || companySettings.address;
          if (address) doc.text(address, 150, textY, { align: "right" });

          const phone = companySettings.company_phone || companySettings.phone;
          if (phone)
            doc.text(`Phone: ${phone}`, 150, textY + 12, { align: "right" });

          const email = companySettings.company_email || companySettings.email;
          if (email)
            doc.text(`Email: ${email}`, 150, textY + 24, { align: "right" });

          const gstNo = companySettings.gst_number || companySettings.gst_no;
          if (gstNo)
            doc.text(`GST No: ${gstNo}`, 150, textY + 36, { align: "right" });
        } else {
          // Default fallback
          doc
            .fontSize(16)
            .font("Helvetica-Bold")
            .text("GASFLOW ERP", 150, currentY, { align: "right" });
        }

        // Title
        doc.moveDown(1);
        doc
          .fontSize(20)
          .font("Helvetica-Bold")
          .fillColor("#1a56db")
          .text("TAX INVOICE", 50, 140, { align: "center" });
        doc.fillColor("#000000");

        // ==============================================
        // INVOICE INFO BOX
        // ==============================================

        doc.fillColor("#f3f4f6").rect(50, 170, 495, 45).fill();
        doc.fillColor("#000000").fontSize(9).font("Helvetica");

        doc.text(`Invoice No: ${invoiceData.invoice_no || ""}`, 60, 183);
        doc.text(
          `Date: ${moment(invoiceData.invoice_date).format("DD/MM/YYYY")}`,
          60,
          196,
        );
        doc.text(
          `Due Date: ${moment(invoiceData.due_date).format("DD/MM/YYYY")}`,
          60,
          209,
        );

        doc.text(
          `Payment Status: ${invoiceData.payment_status?.toUpperCase() || "UNPAID"}`,
          350,
          183,
        );
        if (invoiceData.payment_method)
          doc.text(`Payment Method: ${invoiceData.payment_method}`, 350, 196);
        if (invoiceData.transaction_id)
          doc.text(`Transaction ID: ${invoiceData.transaction_id}`, 350, 209);

        // ==============================================
        // BILL TO & SHIP TO
        // ==============================================

        // Bill To
        doc
          .fillColor("#1a56db")
          .fontSize(10)
          .font("Helvetica-Bold")
          .text("BILL TO", 50, 245);
        doc.fillColor("#000000").fontSize(9).font("Helvetica");

        let billY = 260;
        doc.text(invoiceData.party_name || "", 50, billY);
        if (invoiceData.party_address) {
          const addressLines = String(invoiceData.party_address).split("\n");
          addressLines.forEach((line) => {
            billY += 13;
            doc.text(line, 50, billY);
          });
        }
        if (invoiceData.party_gst) {
          billY += 13;
          doc.text(`GSTIN: ${invoiceData.party_gst}`, 50, billY);
        }

        // Ship To
        doc
          .fillColor("#1a56db")
          .fontSize(10)
          .font("Helvetica-Bold")
          .text("SHIP TO", 350, 245);
        doc.fillColor("#000000").fontSize(9).font("Helvetica");

        let shipY = 260;
        const shippingAddress =
          invoiceData.shipping_address || invoiceData.party_address || "";
        const addressLines = String(shippingAddress).split("\n");
        addressLines.forEach((line) => {
          doc.text(line, 350, shipY);
          shipY += 13;
        });
        if (invoiceData.shipping_gst) {
          doc.text(`GSTIN: ${invoiceData.shipping_gst}`, 350, shipY);
        }

        // ==============================================
        // ITEMS TABLE
        // ==============================================

        const tableTop = Math.max(billY, shipY) + 25;

        // Table Header
        doc.fillColor("#1a56db").rect(50, tableTop, 495, 22).fill();
        doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold");

        // Define column positions
        const col1X = 55; // S.No
        const col2X = 80; // Description
        const col3X = 270; // Qty
        const col4X = 320; // Rate (adjusted)
        const col5X = 390; // GST%
        const col6X = 450; // Amount (fixed alignment)

        // Header Text (FIXED)
        doc.text("#", col1X, tableTop + 7);
        doc.text("Description", col2X, tableTop + 7);
        doc.text("Qty", col3X, tableTop + 7);

        doc.text("Rate", col4X, tableTop + 7, {
          width: 60,
          align: "right",
        });

        doc.text("GST%", col5X, tableTop + 7, {
          width: 40,
          align: "center",
        });

        doc.text("Amount", col6X, tableTop + 7, {
          width: 80,
          align: "right",
        });

        // Table Rows
        let y = tableTop + 30;

        doc.fillColor("#000000").fontSize(9).font("Helvetica");

        const items = invoiceData.items || [];
        let rowCount = 0;

        items.forEach((item, index) => {
          // Alternating row background
          if (rowCount % 2 === 0) {
            doc
              .fillColor("#f9fafb")
              .rect(50, y - 5, 495, 22)
              .fill();
          }

          doc.fillColor("#000000");

          const quantity = Number(item.quantity) || 0;
          const rate = Number(item.rate) || 0;
          const gstPercent = Number(item.gst_percent) || 0;

          const amount = quantity * rate;
          const gstAmount = (amount * gstPercent) / 100;
          const itemTotal = amount + gstAmount;

          // S.No
          doc.text((index + 1).toString(), col1X, y);

          // Description
          const description =
            item.cylinder_name ||
            item.cylinder_type_name ||
            `Item ${index + 1}`;

          const descWidth = col3X - col2X - 10;

          doc.text(description, col2X, y, {
            width: descWidth,
          });

          // Qty
          doc.text(quantity.toString(), col3X, y, {
            width: 10,
            align: "center",
          });

          // Rate (FIXED)
          doc.text(`₹${rate.toFixed(2)}`, col4X, y, {
            width: 60,
            align: "right",
          });

          // GST% (FIXED)
          doc.text(`${gstPercent}%`, col5X, y, {
            width: 40,
            align: "center",
          });

          // Amount (FIXED MAIN ISSUE)
          doc.text(`₹${itemTotal.toFixed(2)}`, col6X, y, {
            width: 80,
            align: "right",
          });

          y += 22;
          rowCount++;
        });
        // ==============================================
        // SUMMARY SECTION & BANK DETAILS (SIDE BY SIDE)
        // ==============================================

        const summaryY = Math.max(y + 15, 500);

        // ==============================================
        // BANK DETAILS BOX (LEFT)
        // ==============================================

        if (
          companySettings &&
          (companySettings.bank_name || companySettings.account_number)
        ) {
          doc.fillColor("#f3f4f6").rect(50, summaryY, 235, 120).fill();

          doc.fillColor("#1a56db").font("Helvetica-Bold").fontSize(10);

          doc.text("Bank Details", 65, summaryY + 15);

          doc.fillColor("#000000").font("Helvetica").fontSize(8);

          let bankTextY = summaryY + 35;

          if (companySettings.bank_name) {
            doc.text(`Bank: ${companySettings.bank_name}`, 65, bankTextY, {
              width: 200,
            });
            bankTextY += 14;
          }

          if (companySettings.account_number) {
            doc.text(
              `Account No: ${companySettings.account_number}`,
              65,
              bankTextY,
              {
                width: 200,
              },
            );
            bankTextY += 14;
          }

          if (companySettings.ifsc_code) {
            doc.text(`IFSC Code: ${companySettings.ifsc_code}`, 65, bankTextY, {
              width: 200,
            });
            bankTextY += 14;
          }

          if (companySettings.branch_name) {
            doc.text(`Branch: ${companySettings.branch_name}`, 65, bankTextY, {
              width: 200,
            });
            bankTextY += 14;
          }

          if (companySettings.upi_id) {
            doc.text(`UPI ID: ${companySettings.upi_id}`, 65, bankTextY, {
              width: 200,
            });
          }
        }

        // ==============================================
        // SUMMARY BOX (RIGHT - Near Item Table)
        // ==============================================

        // Add margin top to summary box
        const summaryMarginTop = -80;
        const summaryBoxY = summaryY + summaryMarginTop;

        doc.fillColor("#f3f4f6").rect(310, summaryBoxY, 250, 150).fill();
        doc.fillColor("#000000").fontSize(9).font("Helvetica");

        let sumY = summaryBoxY + 15;

        const subtotal = Number(invoiceData.subtotal) || 0;
        const gstAmount = Number(invoiceData.gst_amount) || 0;
        const discountAmount = Number(invoiceData.discount_amount) || 0;
        const netAmount = Number(invoiceData.net_amount) || 0;
        const paidAmount = Number(invoiceData.paid_amount) || 0;
        const balanceAmount = Number(invoiceData.balance_amount) || 0;

        sumY += 20;

        doc.font("Helvetica").fillColor("#000000").fontSize(9);

        doc.text("Subtotal:", 325, sumY);
        doc.text(`₹${subtotal.toFixed(2)}`, 465, sumY, {
          width: 80,
          align: "right",
        });
        sumY += 18;

        doc.text("GST Amount:", 325, sumY);
        doc.text(`₹${gstAmount.toFixed(2)}`, 465, sumY, {
          width: 80,
          align: "right",
        });
        sumY += 18;

        if (discountAmount > 0) {
          doc.text("Discount:", 325, sumY);
          doc.text(`-₹${discountAmount.toFixed(2)}`, 465, sumY, {
            width: 80,
            align: "right",
          });
          sumY += 18;
        }

        doc.moveTo(325, sumY).lineTo(525, sumY).strokeColor("#d1d5db").stroke();

        sumY += 12;

        doc.fillColor("#1a56db").font("Helvetica-Bold").fontSize(10);

        doc.text("Total Amount:", 325, sumY);
        doc.text(`₹${netAmount.toFixed(2)}`, 465, sumY, {
          width: 80,
          align: "right",
        });

        if (paidAmount > 0) {
          sumY += 20;

          doc.fillColor("#10b981").font("Helvetica").fontSize(9);

          doc.text("Paid:", 325, sumY);
          doc.text(`₹${paidAmount.toFixed(2)}`, 465, sumY, {
            width: 80,
            align: "right",
          });

          if (balanceAmount > 0) {
            sumY += 18;

            doc.fillColor("#ef4444");

            doc.text("Balance:", 325, sumY);
            doc.text(`₹${balanceAmount.toFixed(2)}`, 465, sumY, {
              width: 80,
              align: "right",
            });
          }
        }

        // Set signature Y position based on the taller of the two boxes with margin top considered
        var signY = Math.max(summaryBoxY + 140, 620);
        // ==============================================
        // SIGNATURE SECTION
        // ==============================================

        doc.fillColor("#000000").fontSize(9).font("Helvetica");
        doc.text("For", 400, signY);
        doc.text(
          companySettings?.company_name || "GASFLOW ERP",
          400,
          signY + 14,
        );
        doc.text("Authorized Signatory", 400, signY + 28);
        doc
          .moveTo(400, signY + 42)
          .lineTo(520, signY + 42)
          .stroke();

        doc.text("Receiver's Signature", 50, signY + 28);
        doc
          .moveTo(50, signY + 42)
          .lineTo(180, signY + 42)
          .stroke();

        // ==============================================
        // FOOTER
        // ==============================================

        doc.fillColor("#9ca3af").fontSize(7);
        doc.text("Thank you for your business!", 50, 770, { align: "center" });
        doc.text(
          `Generated on: ${moment().format("DD/MM/YYYY HH:mm:ss")}`,
          50,
          782,
          { align: "center" },
        );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  async generateExcel(invoiceData) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Invoice");

    this._renderExcelHeader(worksheet, invoiceData);
    this._renderExcelItems(worksheet, invoiceData);
    this._renderExcelSummary(worksheet, invoiceData);

    worksheet.columns.forEach((column) => (column.width = 20));
    return await workbook.xlsx.writeBuffer();
  }

  _renderExcelHeader(worksheet, invoiceData) {
    worksheet.mergeCells("A1:F1");
    worksheet.getCell("A1").value = "TAX INVOICE";
    worksheet.getCell("A1").font = { size: 16, bold: true };
    worksheet.getCell("A1").alignment = { horizontal: "center" };

    worksheet.addRow([]);
    worksheet.addRow(["Invoice No:", invoiceData.invoice_no]);
    worksheet.addRow([
      "Date:",
      moment(invoiceData.invoice_date).format("DD/MM/YYYY"),
    ]);
    worksheet.addRow([
      "Due Date:",
      moment(invoiceData.due_date).format("DD/MM/YYYY"),
    ]);
    worksheet.addRow([]);
    worksheet.addRow(["Bill To:"]);
    worksheet.addRow([invoiceData.party_name]);
    if (invoiceData.party_address)
      worksheet.addRow([invoiceData.party_address]);
    if (invoiceData.party_gst)
      worksheet.addRow([`GST: ${invoiceData.party_gst}`]);
    worksheet.addRow([]);
  }

  _renderExcelItems(worksheet, invoiceData) {
    worksheet.addRow(["S.No", "Product", "Quantity", "Rate", "GST%", "Amount"]);
    invoiceData.items.forEach((item, index) => {
      const amount = item.quantity * item.rate;
      const gstAmount = (amount * (item.gst_percent || 0)) / 100;
      const itemTotal = amount + gstAmount;
      worksheet.addRow([
        index + 1,
        item.cylinder_name,
        item.quantity,
        item.rate,
        `${item.gst_percent || 0}%`,
        itemTotal.toFixed(2),
      ]);
    });
  }

  _renderExcelSummary(worksheet, invoiceData) {
    worksheet.addRow([]);
    worksheet.addRow(["", "", "", "", "Subtotal:", invoiceData.subtotal]);
    worksheet.addRow(["", "", "", "", "GST Amount:", invoiceData.gst_amount]);
    if (invoiceData.discount_amount > 0)
      worksheet.addRow([
        "",
        "",
        "",
        "",
        "Discount:",
        -invoiceData.discount_amount,
      ]);
    worksheet.addRow(["", "", "", "", "Total:", invoiceData.net_amount]);
  }

  generateCSV(invoiceData) {
    const items = invoiceData.items.map((item, index) => ({
      "Invoice No": invoiceData.invoice_no,
      Date: moment(invoiceData.invoice_date).format("DD/MM/YYYY"),
      "Party Name": invoiceData.party_name,
      "S.No": index + 1,
      Product: item.cylinder_name,
      Quantity: item.quantity,
      Rate: item.rate,
      "GST%": item.gst_percent,
      Amount: (
        item.quantity *
        item.rate *
        (1 + (item.gst_percent || 0) / 100)
      ).toFixed(2),
      Subtotal: invoiceData.subtotal,
      "GST Total": invoiceData.gst_amount,
      Discount: invoiceData.discount_amount,
      "Net Amount": invoiceData.net_amount,
    }));
    const parser = new Parser();
    return parser.parse(items);
  }

  generateJSON(invoiceData) {
    return JSON.stringify(
      {
        invoice: {
          id: invoiceData.id,
          invoice_no: invoiceData.invoice_no,
          invoice_date: invoiceData.invoice_date,
          due_date: invoiceData.due_date,
          party_name: invoiceData.party_name,
          party_gst: invoiceData.party_gst,
          party_address: invoiceData.party_address,
          subtotal: invoiceData.subtotal,
          gst_amount: invoiceData.gst_amount,
          discount_amount: invoiceData.discount_amount,
          net_amount: invoiceData.net_amount,
          payment_status: invoiceData.payment_status,
          items: invoiceData.items.map((item) => ({
            product: item.cylinder_name,
            quantity: item.quantity,
            rate: item.rate,
            gst_percent: item.gst_percent,
            amount:
              item.quantity * item.rate * (1 + (item.gst_percent || 0) / 100),
          })),
          payments: invoiceData.payments,
        },
      },
      null,
      2,
    );
  }
}

module.exports = new InvoiceService();
