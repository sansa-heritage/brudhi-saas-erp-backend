// src/modules/cylinder/cylinder.service.js
const db = require("../../config/db");

// Helper function to get tenant-specific connection
const getTenantDb = async (tenantId) => {
  // Get tenant database name from tenants table
  const [tenant] = await db.query(
    "SELECT database_name FROM tenants WHERE id = ?",
    [tenantId]
  );
  if (!tenant[0]) {
    throw new Error("Tenant not found");
  }
  return tenant[0].database_name;
};

// Execute query on tenant database
const executeTenantQuery = async (tenantId, query, params = []) => {
  const tenantDb = await getTenantDb(tenantId);
  const [rows] = await db.query(`USE ${tenantDb}`);
  const [result] = await db.query(query, params);
  return result;
};

// ==================== CYLINDER TYPES ====================
const getCylinderTypes = async (tenantId) => {
  const tenantDb = await getTenantDb(tenantId);
  await db.query(`USE ${tenantDb}`);
  const [rows] = await db.query(
    "SELECT * FROM cylinder_types WHERE deleted_at IS NULL ORDER BY id DESC"
  );
  return rows;
};

const getCylinderTypeById = async (id, tenantId) => {
  const tenantDb = await getTenantDb(tenantId);
  await db.query(`USE ${tenantDb}`);
  const [rows] = await db.query(
    "SELECT * FROM cylinder_types WHERE id = ?",
    [id]
  );
  return rows[0];
};

const createCylinderType = async (data, tenantId, userId) => {
  const tenantDb = await getTenantDb(tenantId);
  await db.query(`USE ${tenantDb}`);
  const [result] = await db.query(
    `INSERT INTO cylinder_types (name, weight, type, capacity_kg, price, gst_percent, description, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.name, data.weight, data.type, data.capacity_kg, data.price, data.gst_percent, data.description, data.status, userId]
  );
  return getCylinderTypeById(result.insertId, tenantId);
};

const updateCylinderType = async (id, data, tenantId) => {
  const tenantDb = await getTenantDb(tenantId);
  await db.query(`USE ${tenantDb}`);
  await db.query(
    `UPDATE cylinder_types SET name = ?, weight = ?, type = ?, capacity_kg = ?, price = ?, gst_percent = ?, description = ?, status = ?
     WHERE id = ?`,
    [data.name, data.weight, data.type, data.capacity_kg, data.price, data.gst_percent, data.description, data.status, id]
  );
  return getCylinderTypeById(id, tenantId);
};

const deleteCylinderType = async (id, tenantId) => {
  const tenantDb = await getTenantDb(tenantId);
  await db.query(`USE ${tenantDb}`);
  await db.query(
    "UPDATE cylinder_types SET deleted_at = NOW() WHERE id = ?",
    [id]
  );
};

const getCylinderTypeStats = async (tenantId) => {
  const tenantDb = await getTenantDb(tenantId);
  await db.query(`USE ${tenantDb}`);
  const [total] = await db.query("SELECT COUNT(*) as count FROM cylinder_types WHERE deleted_at IS NULL");
  const [active] = await db.query("SELECT COUNT(*) as count FROM cylinder_types WHERE status = 'active' AND deleted_at IS NULL");
  return { 
    totalTypes: total[0].count, 
    activeTypes: active[0].count, 
    inactiveTypes: total[0].count - active[0].count 
  };
};

// ==================== CYLINDER STOCK ====================
const getCylinders = async (tenantId) => {
  const tenantDb = await getTenantDb(tenantId);
  await db.query(`USE ${tenantDb}`);
  const [rows] = await db.query(
    `SELECT c.*, ct.name as cylinder_type_name 
     FROM cylinders c 
     LEFT JOIN cylinder_types ct ON c.cylinder_type_id = ct.id 
     WHERE c.deleted_at IS NULL 
     ORDER BY c.id DESC`
  );
  return rows;
};

const getCylinderById = async (id, tenantId) => {
  const tenantDb = await getTenantDb(tenantId);
  await db.query(`USE ${tenantDb}`);
  const [rows] = await db.query(
    `SELECT c.*, ct.name as cylinder_type_name 
     FROM cylinders c 
     LEFT JOIN cylinder_types ct ON c.cylinder_type_id = ct.id 
     WHERE c.id = ?`,
    [id]
  );
  return rows[0];
};

const createCylinder = async (data, tenantId, userId) => {
  const tenantDb = await getTenantDb(tenantId);
  await db.query(`USE ${tenantDb}`);
  const [result] = await db.query(
    `INSERT INTO cylinders (cylinder_type_id, cylinder_code, serial_number, batch_number, manufacturing_date, expiry_date, status, location, last_inspection_date, next_inspection_date, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.cylinder_type_id, data.cylinder_code, data.serial_number, data.batch_number, data.manufacturing_date, data.expiry_date, data.status, data.location, data.last_inspection_date, data.next_inspection_date, data.notes, userId]
  );
  return getCylinderById(result.insertId, tenantId);
};

const updateCylinder = async (id, data, tenantId) => {
  const tenantDb = await getTenantDb(tenantId);
  await db.query(`USE ${tenantDb}`);
  await db.query(
    `UPDATE cylinders SET cylinder_type_id = ?, cylinder_code = ?, serial_number = ?, batch_number = ?, manufacturing_date = ?, expiry_date = ?, status = ?, location = ?, last_inspection_date = ?, next_inspection_date = ?, notes = ?
     WHERE id = ?`,
    [data.cylinder_type_id, data.cylinder_code, data.serial_number, data.batch_number, data.manufacturing_date, data.expiry_date, data.status, data.location, data.last_inspection_date, data.next_inspection_date, data.notes, id]
  );
  return getCylinderById(id, tenantId);
};

const deleteCylinder = async (id, tenantId) => {
  const tenantDb = await getTenantDb(tenantId);
  await db.query(`USE ${tenantDb}`);
  await db.query(
    "UPDATE cylinders SET deleted_at = NOW() WHERE id = ?",
    [id]
  );
};

const updateCylinderStatus = async (id, status, tenantId) => {
  const tenantDb = await getTenantDb(tenantId);
  await db.query(`USE ${tenantDb}`);
  await db.query(
    "UPDATE cylinders SET status = ? WHERE id = ?",
    [status, id]
  );
  return getCylinderById(id, tenantId);
};

const getCylindersByType = async (typeId, tenantId) => {
  const tenantDb = await getTenantDb(tenantId);
  await db.query(`USE ${tenantDb}`);
  const [rows] = await db.query(
    "SELECT * FROM cylinders WHERE cylinder_type_id = ? AND deleted_at IS NULL",
    [typeId]
  );
  return rows;
};

// ==================== LOW STOCK ALERTS ====================
const getLowStockAlerts = async (tenantId) => {
  const threshold = await getLowStockThreshold(tenantId);
  const tenantDb = await getTenantDb(tenantId);
  await db.query(`USE ${tenantDb}`);
  const [rows] = await db.query(
    `SELECT ct.id, ct.name as cylinder_type, ct.weight, COUNT(c.id) as current_stock, ? as threshold
     FROM cylinder_types ct
     LEFT JOIN cylinders c ON ct.id = c.cylinder_type_id AND c.status = 'in_stock' AND c.deleted_at IS NULL
     WHERE ct.deleted_at IS NULL
     GROUP BY ct.id
     HAVING current_stock < ?`,
    [threshold, threshold]
  );
  return rows;
};

const getLowStockThreshold = async (tenantId) => {
  const tenantDb = await getTenantDb(tenantId);
  await db.query(`USE ${tenantDb}`);
  const [rows] = await db.query(
    "SELECT setting_value FROM settings WHERE setting_key = 'low_stock_threshold'"
  );
  return rows[0] ? parseInt(rows[0].setting_value) : 5;
};

const updateLowStockThreshold = async (threshold, tenantId) => {
  const tenantDb = await getTenantDb(tenantId);
  await db.query(`USE ${tenantDb}`);
  await db.query(
    `INSERT INTO settings (setting_key, setting_value) 
     VALUES ('low_stock_threshold', ?) 
     ON DUPLICATE KEY UPDATE setting_value = ?`,
    [threshold, threshold]
  );
  return threshold;
};

// ==================== STOCK TRANSACTIONS ====================
const getStockTransactions = async (tenantId) => {
  const tenantDb = await getTenantDb(tenantId);
  await db.query(`USE ${tenantDb}`);
  const [rows] = await db.query(
    "SELECT * FROM stock_transactions ORDER BY date DESC, id DESC"
  );
  return rows;
};

const getStockTransactionById = async (id, tenantId) => {
  const tenantDb = await getTenantDb(tenantId);
  await db.query(`USE ${tenantDb}`);
  const [rows] = await db.query(
    "SELECT * FROM stock_transactions WHERE id = ?",
    [id]
  );
  return rows[0];
};

const createStockTransaction = async (data, tenantId, userId) => {
  const tenantDb = await getTenantDb(tenantId);
  await db.query(`USE ${tenantDb}`);
  const transactionNo = `TRX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const [result] = await db.query(
    `INSERT INTO stock_transactions (transaction_no, cylinder_id, cylinder_type_id, cylinder_code, type, quantity, date, from_location, to_location, reference_no, amount, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [transactionNo, data.cylinder_id, data.cylinder_type_id, data.cylinder_code, data.type, data.quantity, data.date, data.from_location, data.to_location, data.reference_no, data.amount, data.notes, userId]
  );
  return getStockTransactionById(result.insertId, tenantId);
};

const getStockTransactionsByCylinder = async (cylinderId, tenantId) => {
  const tenantDb = await getTenantDb(tenantId);
  await db.query(`USE ${tenantDb}`);
  const [rows] = await db.query(
    "SELECT * FROM stock_transactions WHERE cylinder_id = ? ORDER BY date DESC",
    [cylinderId]
  );
  return rows;
};

// ==================== STATISTICS ====================
const getStockStatistics = async (tenantId) => {
  const tenantDb = await getTenantDb(tenantId);
  await db.query(`USE ${tenantDb}`);
  
  const [total] = await db.query("SELECT COUNT(*) as count FROM cylinders WHERE deleted_at IS NULL");
  const [inStock] = await db.query("SELECT COUNT(*) as count FROM cylinders WHERE status = 'in_stock' AND deleted_at IS NULL");
  const [issued] = await db.query("SELECT COUNT(*) as count FROM cylinders WHERE status = 'issued' AND deleted_at IS NULL");
  const [damaged] = await db.query("SELECT COUNT(*) as count FROM cylinders WHERE status = 'damaged' AND deleted_at IS NULL");
  const [returned] = await db.query("SELECT COUNT(*) as count FROM cylinders WHERE status = 'returned' AND deleted_at IS NULL");
  
  return {
    totalCylinders: total[0].count,
    inStock: inStock[0].count,
    issued: issued[0].count,
    damaged: damaged[0].count,
    returned: returned[0].count,
    lowStockCount: 0,
    lowStockItems: []
  };
};

// ==================== EXPORTS ====================
module.exports = {
  getCylinderTypes,
  getCylinderTypeById,
  createCylinderType,
  updateCylinderType,
  deleteCylinderType,
  getCylinderTypeStats,
  getCylinders,
  getCylinderById,
  createCylinder,
  updateCylinder,
  deleteCylinder,
  updateCylinderStatus,
  getCylindersByType,
  getLowStockAlerts,
  getLowStockThreshold,
  updateLowStockThreshold,
  getStockTransactions,
  getStockTransactionById,
  createStockTransaction,
  getStockTransactionsByCylinder,
  getStockStatistics
};