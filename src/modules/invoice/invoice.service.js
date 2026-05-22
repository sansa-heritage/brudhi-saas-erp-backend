const DatabaseManager = require("../../services/database-manager.service");
const moment = require("moment");
const PDFDocument = require("pdfkit"); // Make sure to install: npm install pdfkit
const ExcelJS = require("exceljs"); // ← ADD THIS LINE
const { Parser } = require("json2csv"); // ← ADD THIS LINE

class InvoiceService {
  async generateInvoiceNumber(tenantId, db, type) {
    const prefix = type === "customer" ? "INV" : "DLR";
    const date = moment();
    const year = date.format("YYYY");
    const month = date.format("MM");

    try {
      let rows;
      const searchPattern = `${prefix}/${year}${month}/%`;

      if (db.execute) {
        const [result] = await db.execute(
          `SELECT invoice_no FROM invoices 
           WHERE invoice_no LIKE ? 
           ORDER BY id DESC LIMIT 1`,
          [searchPattern],
        );
        rows = result;
      } else {
        rows = await db.query(
          `SELECT invoice_no FROM invoices 
           WHERE invoice_no LIKE ? 
           ORDER BY id DESC LIMIT 1`,
          [searchPattern],
        );
      }

      let sequence = 1;
      if (rows && rows.length > 0 && rows[0] && rows[0].invoice_no) {
        const lastNumber = rows[0].invoice_no.split("/").pop();
        if (lastNumber && !isNaN(parseInt(lastNumber))) {
          sequence = parseInt(lastNumber) + 1;
        }
      }

      const sequenceStr = String(sequence).padStart(4, "0");
      return `${prefix}/${year}${month}/${sequenceStr}`;
    } catch (error) {
      console.error("Error generating invoice number:", error);
      const timestamp = Date.now();
      return `${prefix}/${year}${month}/${timestamp}`;
    }
  }

  async getAllInvoices(tenantId, filters = {}) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
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

      query += " ORDER BY i.created_at DESC";

      // ✅ FIX: Declare page, limit, offset before using them
      const page = Number(filters.page) || 1;
      const limit = Math.min(100, Number(filters.limit) || 10);
      const offset = (page - 1) * limit;

      query += " LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const [invoices] = await db.query(query, params);

      // Get items for each invoice
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
          items: items,
          item_count: items.length,
        });
      }

      const [countResult] = await db.query(
        "SELECT COUNT(*) as total FROM invoices",
      );
      const total = countResult[0]?.total || 0;

      return {
        data: invoicesWithItems,
        pagination: {
          page: page,
          limit: limit,
          total: total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } finally {
      await db.end();
    }
  }

  // ✅ FIXED: Use destructuring to get clean data
  async getInvoiceById(tenantId, id) {
    if (!id || isNaN(id)) {
      throw new Error("Invalid invoice ID");
    }

    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      const [invoices] = await db.query(`SELECT * FROM invoices WHERE id = ?`, [
        Number(id),
      ]);

      if (!invoices || invoices.length === 0) return null;

      const invoice = invoices[0];

      // Get invoice items
      const [items] = await db.query(
        `SELECT ii.*, ct.name as cylinder_name, ct.weight
         FROM invoice_items ii
         LEFT JOIN cylinder_types ct ON ii.cylinder_type_id = ct.id
         WHERE ii.invoice_id = ?`,
        [Number(id)],
      );

      invoice.items = items || [];

      // Get payments
      const [payments] = await db.query(
        `SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC`,
        [Number(id)],
      );

      invoice.payments = payments || [];

      return invoice;
    } catch (error) {
      console.error("Error in getInvoiceById:", error);
      throw error;
    } finally {
      await db.end();
    }
  }

  async createInvoice(tenantId, invoiceData, items) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

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

      let discountAmount = 0;
      const discountType = invoiceData.discountType || "fixed";
      const discountValue = Number(invoiceData.discountValue) || 0;

      if (discountType === "percentage") {
        discountAmount = (subtotal * discountValue) / 100;
      } else {
        discountAmount = discountValue;
      }

      const taxableAmount = subtotal - discountAmount;
      const totalAmount = taxableAmount + totalGst;
      const roundOff = Number(invoiceData.roundOff) || 0;
      const netAmount = totalAmount + roundOff;
      const paymentStatus = invoiceData.paymentStatus || "unpaid";
      const paidAmount = Number(invoiceData.paidAmount) || 0;
      const balanceAmount = netAmount - paidAmount;

      const invoiceNo = await this.generateInvoiceNumber(
        tenantId,
        connection,
        invoiceData.partyType,
      );

      const invoiceDate =
        invoiceData.invoiceDate || moment().format("YYYY-MM-DD");
      const dueDate =
        invoiceData.dueDate || moment().add(30, "days").format("YYYY-MM-DD");
      const partyType = invoiceData.partyType;
      const partyId = invoiceData.partyId ? Number(invoiceData.partyId) : null;
      const partyName = invoiceData.partyName;
      const partyGst = invoiceData.partyGst || null;
      const partyAddress = invoiceData.partyAddress || null;
      const notes = invoiceData.notes || null;
      const createdBy = invoiceData.createdBy
        ? Number(invoiceData.createdBy)
        : null;
      const transactionId = invoiceData.transactionId || null;
      const paymentMethod = invoiceData.paymentMethod || null;
      const termsConditions = invoiceData.termsConditions || null;

      if (!partyType) throw new Error("partyType is required");
      if (!partyId) throw new Error("partyId is required");
      if (!partyName) throw new Error("partyName is required");
      if (!createdBy) throw new Error("createdBy is required");

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
          partyType,
          partyId,
          partyName,
          partyGst,
          partyAddress,
          subtotal,
          discountType,
          discountValue,
          discountAmount,
          taxableAmount,
          totalGst,
          totalAmount,
          roundOff,
          netAmount,
          paymentStatus,
          paidAmount,
          balanceAmount,
          paymentMethod,
          transactionId,
          notes,
          termsConditions,
          createdBy,
        ],
      );

      const invoiceId = result.insertId;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const cylinderTypeId = item.cylinderTypeId
          ? Number(item.cylinderTypeId)
          : null;
        const quantity = Number(item.quantity) || 0;
        const rate = Number(item.rate) || 0;
        const discountPercent = Number(item.discountPercent) || 0;
        const discountAmountItem = Number(item.discountAmount) || 0;
        const gstPercent = Number(item.gstPercent) || 5;

        if (!cylinderTypeId)
          throw new Error(`cylinderTypeId required for item ${i + 1}`);
        if (quantity <= 0)
          throw new Error(`quantity must be > 0 for item ${i + 1}`);
        if (rate <= 0) throw new Error(`rate must be > 0 for item ${i + 1}`);

        const itemTotal = quantity * rate;
        const gstAmount = (itemTotal * gstPercent) / 100;
        const totalAmountItem = itemTotal + gstAmount - discountAmountItem;

        await connection.execute(
          `INSERT INTO invoice_items (
            invoice_id, cylinder_type_id, quantity, rate, discount_percent,
            discount_amount, taxable_amount, gst_percent, gst_amount, total_amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            invoiceId,
            cylinderTypeId,
            quantity,
            rate,
            discountPercent,
            discountAmountItem,
            itemTotal,
            gstPercent,
            gstAmount,
            totalAmountItem,
          ],
        );

        await connection.execute(
          `UPDATE gas_stocks 
           SET available_stock = available_stock - ?,
               updated_at = NOW()
           WHERE cylinder_type_id = ?`,
          [quantity, cylinderTypeId],
        );
      }

      await connection.commit();
      return invoiceId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async recordPayment(tenantId, paymentData) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [invoice] = await connection.execute(
        "SELECT total_amount, paid_amount FROM invoices WHERE id = ?",
        [paymentData.invoiceId],
      );

      if (!invoice || invoice.length === 0) {
        throw new Error("Invoice not found");
      }

      const currentPaidAmount = invoice[0].paid_amount || 0;
      const newPaidAmount = currentPaidAmount + paymentData.amount;
      const newBalanceAmount = invoice[0].total_amount - newPaidAmount;
      const paymentStatus =
        newPaidAmount >= invoice[0].total_amount ? "paid" : "partial";

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

      await connection.execute(
        `UPDATE invoices 
         SET paid_amount = ?, 
             balance_amount = ?,
             payment_status = ?, 
             updated_at = NOW()
         WHERE id = ?`,
        [newPaidAmount, newBalanceAmount, paymentStatus, paymentData.invoiceId],
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

  // ✅ FIXED: Update only updatable fields (not party_type or party_id)
  async updateInvoice(tenantId, id, invoiceData) {
    if (!id || isNaN(id)) {
      throw new Error("Invalid invoice ID");
    }

    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // Check if invoice exists
      const [existingInvoices] = await connection.execute(
        "SELECT id, subtotal, discount_type, discount_value, discount_amount, taxable_amount, gst_amount, total_amount, round_off, net_amount, paid_amount FROM invoices WHERE id = ?",
        [Number(id)],
      );

      if (existingInvoices.length === 0) {
        throw new Error("Invoice not found");
      }

      const currentInvoice = existingInvoices[0];

      // Get current values
      let subtotal = parseFloat(currentInvoice.subtotal) || 0;
      let discountType =
        invoiceData.discountType || currentInvoice.discount_type;
      let discountValue =
        invoiceData.discountValue !== undefined
          ? parseFloat(invoiceData.discountValue)
          : parseFloat(currentInvoice.discount_value);
      let roundOff =
        invoiceData.roundOff !== undefined
          ? parseFloat(invoiceData.roundOff)
          : parseFloat(currentInvoice.round_off);
      let paidAmount =
        invoiceData.paidAmount !== undefined
          ? parseFloat(invoiceData.paidAmount)
          : parseFloat(currentInvoice.paid_amount);

      // Calculate discount amount
      let discountAmount = 0;
      if (discountType === "percentage") {
        discountAmount = (subtotal * discountValue) / 100;
      } else {
        discountAmount = discountValue;
      }

      // Recalculate all totals
      const taxableAmount = subtotal - discountAmount;
      const gstAmount = parseFloat(currentInvoice.gst_amount) || 0;
      const totalAmount = taxableAmount + gstAmount;
      const netAmount = totalAmount + roundOff;
      const balanceAmount = netAmount - paidAmount;

      // Build update query
      const updates = [];
      const params = [];

      // Add field mappings
      const fieldMap = {
        party_name: invoiceData.partyName,
        party_gst: invoiceData.partyGst,
        party_address: invoiceData.partyAddress,
        invoice_date: invoiceData.invoiceDate,
        due_date: invoiceData.dueDate,
        discount_type: discountType,
        discount_value: discountValue,
        discount_amount: discountAmount,
        taxable_amount: taxableAmount,
        total_amount: totalAmount,
        round_off: roundOff,
        net_amount: netAmount,
        paid_amount: paidAmount,
        balance_amount: balanceAmount,
        payment_status: invoiceData.paymentStatus,
        payment_method: invoiceData.paymentMethod,
        transaction_id: invoiceData.transactionId,
        notes: invoiceData.notes,
        terms_conditions: invoiceData.termsConditions,
      };

      for (const [dbField, value] of Object.entries(fieldMap)) {
        if (value !== undefined && value !== null) {
          updates.push(`${dbField} = ?`);
          params.push(value);
        }
      }

      // Also handle camelCase
      const camelMap = {
        partyName: "party_name",
        partyGst: "party_gst",
        partyAddress: "party_address",
        invoiceDate: "invoice_date",
        dueDate: "due_date",
        discountType: "discount_type",
        discountValue: "discount_value",
        roundOff: "round_off",
        paymentStatus: "payment_status",
        paidAmount: "paid_amount",
        paymentMethod: "payment_method",
        transactionId: "transaction_id",
        notes: "notes",
        termsConditions: "terms_conditions",
      };

      for (const [camelField, dbField] of Object.entries(camelMap)) {
        if (
          invoiceData[camelField] !== undefined &&
          invoiceData[camelField] !== null
        ) {
          // Skip if already added via snake_case
          if (fieldMap[dbField] === undefined) {
            let value = invoiceData[camelField];
            if (camelField === "discountValue") {
              value = parseFloat(value);
            }
            updates.push(`${dbField} = ?`);
            params.push(value);
          }
        }
      }

      if (updates.length === 0) {
        await connection.commit();
        return true;
      }

      updates.push("updated_at = NOW()");
      params.push(Number(id));

      await connection.execute(
        `UPDATE invoices SET ${updates.join(", ")} WHERE id = ?`,
        params,
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
  async updateInvoiceStatus(tenantId, invoiceId, status) {
    const db = await DatabaseManager.getTenantDatabaseConnection(tenantId);

    try {
      const validStatuses = ["paid", "unpaid", "partial", "cancelled"];
      if (!validStatuses.includes(status)) {
        throw new Error("Invalid payment status");
      }

      await db.query(
        `UPDATE invoices 
         SET payment_status = ?, updated_at = NOW()
         WHERE id = ?`,
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
        `SELECT * FROM invoices WHERE invoice_no = ?`,
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

  // In invoice.service.js
  // In invoice.service.js
  async deleteInvoice(tenantId, invoiceId) {
    try {
      console.log("=== DELETE INVOICE SERVICE ===");
      console.log("Tenant ID:", tenantId);
      console.log("Invoice ID:", invoiceId);

      // Validate inputs
      if (!tenantId) {
        throw new Error("Tenant ID is required");
      }

      if (!invoiceId || isNaN(invoiceId)) {
        throw new Error("Valid invoice ID is required");
      }

      // Get tenant database connection
      const tenantDb =
        await DatabaseManager.getTenantDatabaseConnection(tenantId);

      try {
        // Check if invoice exists
        const [invoices] = await tenantDb.query(
          "SELECT id, invoice_no, net_amount, payment_status FROM invoices WHERE id = ?",
          [invoiceId],
        );

        if (!invoices || invoices.length === 0) {
          throw new Error("Invoice not found");
        }

        const invoice = invoices[0];

        // Check if invoice is already paid or partially paid
        if (invoice.payment_status === "paid") {
          throw new Error("Cannot delete a paid invoice");
        }

        // Delete invoice items first (foreign key constraint)
        await tenantDb.query("DELETE FROM invoice_items WHERE invoice_id = ?", [
          invoiceId,
        ]);

        // Delete the invoice
        await tenantDb.query("DELETE FROM invoices WHERE id = ?", [invoiceId]);

        console.log("✅ Invoice deleted successfully:", invoiceId);

        return {
          success: true,
          message: "Invoice deleted successfully",
          deletedInvoice: {
            id: invoice.id,
            invoice_no: invoice.invoice_no,
            net_amount: invoice.net_amount,
          },
        };
      } finally {
        await tenantDb.end();
      }
    } catch (error) {
      console.error("Delete invoice service error:", error);
      throw error;
    }
  }

  // Add this method right before the closing module.exports

  async generateInvoicePDF(tenantId, invoiceId) {
    try {
      console.log("=== GENERATE INVOICE PDF SERVICE ===");

      const invoiceData = await this.getInvoiceById(tenantId, invoiceId);

      if (!invoiceData) {
        throw new Error("Invoice not found");
      }

      return new Promise((resolve, reject) => {
        try {
          const doc = new PDFDocument({ margin: 50, size: "A4" });
          const buffers = [];

          doc.on("data", buffers.push.bind(buffers));
          doc.on("end", () => resolve(Buffer.concat(buffers)));

          // Header
          doc
            .fontSize(20)
            .font("Helvetica-Bold")
            .text("TAX INVOICE", 50, 50, { align: "center" });

          // Invoice Details
          doc.fontSize(10).font("Helvetica");
          doc.text(`Invoice No: ${invoiceData.invoice_no}`, 50, 100);
          doc.text(
            `Date: ${moment(invoiceData.invoice_date).format("DD/MM/YYYY")}`,
            50,
            115,
          );
          doc.text(
            `Due Date: ${moment(invoiceData.due_date).format("DD/MM/YYYY")}`,
            50,
            130,
          );
          doc.text(
            `Payment Status: ${invoiceData.payment_status?.toUpperCase() || "UNPAID"}`,
            50,
            145,
          );

          // Party Details
          let y = 180;
          doc.font("Helvetica-Bold").text("Bill To:", 50, y);
          y += 15;
          doc.font("Helvetica");
          doc.text(invoiceData.party_name || "N/A", 50, y);
          y += 15;
          if (invoiceData.party_gst) {
            doc.text(`GSTIN: ${invoiceData.party_gst}`, 50, y);
            y += 15;
          }
          if (invoiceData.party_address) {
            doc.text(invoiceData.party_address, 50, y);
            y += 15;
          }
          y += 20;

          // Items Table
          doc.font("Helvetica-Bold");
          doc.text("S.No", 50, y);
          doc.text("Product", 100, y);
          doc.text("Qty", 250, y);
          doc.text("Rate", 300, y);
          doc.text("GST%", 350, y);
          doc.text("Amount", 450, y, { align: "right" });

          y += 5;
          doc.moveTo(50, y).lineTo(550, y).stroke();
          y += 10;

          doc.font("Helvetica");
          invoiceData.items.forEach((item, index) => {
            const amount = item.quantity * item.rate;
            const gstAmount = (amount * (item.gst_percent || 0)) / 100;
            const itemTotal = amount + gstAmount;

            doc.text((index + 1).toString(), 50, y);
            doc.text(item.cylinder_name || `Item ${index + 1}`, 100, y);
            doc.text(item.quantity.toString(), 250, y);
            doc.text(`₹${item.rate}`, 300, y);
            doc.text(`${item.gst_percent || 0}%`, 350, y);
            doc.text(`₹${itemTotal.toFixed(2)}`, 550, y, { align: "right" });

            y += 20;
          });

          // Summary
          y += 10;
          doc.font("Helvetica-Bold");
          doc.text(`Subtotal: ₹${invoiceData.subtotal}`, 400, y, {
            align: "right",
          });
          y += 15;
          doc.text(`GST Amount: ₹${invoiceData.gst_amount}`, 400, y, {
            align: "right",
          });
          y += 15;
          if (invoiceData.discount_amount > 0) {
            doc.text(`Discount: -₹${invoiceData.discount_amount}`, 400, y, {
              align: "right",
            });
            y += 15;
          }
          y += 10;
          doc
            .fontSize(12)
            .text(`Total: ₹${invoiceData.net_amount}`, 400, y, {
              align: "right",
            });

          doc.end();
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      console.error("Generate PDF error:", error);
      throw error;
    }
  }

  async generateExcel(invoiceData) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Invoice");

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

    worksheet.addRow(["S.No", "Product", "Quantity", "Rate", "GST%", "Amount"]);

    invoiceData.items.forEach((item, index) => {
      const amount = item.quantity * item.rate;
      const gstAmount = (amount * item.gst_percent) / 100;
      const itemTotal = amount + gstAmount;

      worksheet.addRow([
        index + 1,
        item.cylinder_name,
        item.quantity,
        item.rate,
        `${item.gst_percent}%`,
        itemTotal.toFixed(2),
      ]);
    });

    worksheet.addRow([]);
    worksheet.addRow(["", "", "", "", "Subtotal:", invoiceData.subtotal]);
    worksheet.addRow(["", "", "", "", "GST Amount:", invoiceData.gst_amount]);
    if (invoiceData.discount_amount > 0) {
      worksheet.addRow([
        "",
        "",
        "",
        "",
        "Discount:",
        `-${invoiceData.discount_amount}`,
      ]);
    }
    worksheet.addRow(["", "", "", "", "Total:", invoiceData.net_amount]);

    worksheet.columns.forEach((column) => {
      column.width = 20;
    });

    return await workbook.xlsx.writeBuffer();
  }

  async generateCSV(invoiceData) {
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
        (1 + item.gst_percent / 100)
      ).toFixed(2),
      Subtotal: invoiceData.subtotal,
      "GST Total": invoiceData.gst_amount,
      Discount: invoiceData.discount_amount,
      "Net Amount": invoiceData.net_amount,
    }));

    const parser = new Parser();
    return parser.parse(items);
  }

  async generateJSON(invoiceData) {
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
            amount: item.quantity * item.rate * (1 + item.gst_percent / 100),
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
