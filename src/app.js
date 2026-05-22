const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const path = require("path");
const fs = require("fs");
require("express-async-errors");

const config = require("./config/env");
const logger = require("./config/logger");
const ErrorMiddleware = require("./middlewares/error.middleware");

// Import all routes
const authRoutes = require("./modules/auth/auth.routes");
const superadminRoutes = require("./modules/superadmin/superadmin.routes");

// Master Data Routes
const countryRoutes = require("./modules/country/country.routes");
const stateRoutes = require("./modules/state/state.routes");
const cityRoutes = require("./modules/city/city.routes");
const pincodeRoutes = require("./modules/pincode/pincode.routes");
const brandRoutes = require("./modules/brand/brand.routes");
const cylinderTypeRoutes = require("./modules/cylinder-type/cylinder-type.routes");
const cylinderRateRoutes = require("./modules/cylinder-rate/cylinder-rate.routes");

// Tenant Business Routes
const customerRoutes = require("./modules/customer/customer.routes");
const dealerRoutes = require("./modules/dealer/dealer.routes");
const stockRoutes = require("./modules/stock/stock.routes");
const invoiceRoutes = require("./modules/invoice/invoice.routes");
const expenseRoutes = require("./modules/expense/expense.routes");
const reportRoutes = require("./modules/report/report.routes");
const dashboardRoutes = require("./modules/dashboard/dashboard.routes");
const subscriptionRoutes = require("./modules/subscription/subscription.routes");
const logsRoutes = require("./modules/logs/logs.routes");
const userRoutes = require("./modules/user/user.routes");
const tenantRoutes = require("./modules/tenant/tenant.routes");
const staffRoutes = require("./modules/staff/staff.routes");
const inventoryRoutes = require("./modules/inventory/inventory.routes");
const orderRoutes = require("./modules/order/order.routes");
const documentRoutes = require("./modules/document/document.routes");
const cylinderRoutes = require("./modules/cylinder/cylinder.routes");


// Add after other route imports
const superadminPlansRoutes = require("./modules/superadmin-plans/superadmin-plans.routes");

// Add after other route declarations

const app = express();

// ==================== CREATE REQUIRED DIRECTORIES ====================
const uploadsDir = path.join(__dirname, "../uploads");
const logsDir = path.join(__dirname, "../logs");
const backupsDir = path.join(__dirname, "../backups");
const tempDir = path.join(__dirname, "../uploads/temp");

const directories = [uploadsDir, logsDir, backupsDir, tempDir];
directories.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`Created directory: ${dir}`);
  }
});

// Create tenant subdirectories
const tenantDirs = ["tenants", "documents", "backups"];
tenantDirs.forEach((dir) => {
  const tenantDir = path.join(uploadsDir, dir);
  if (!fs.existsSync(tenantDir)) {
    fs.mkdirSync(tenantDir, { recursive: true });
  }
});

// ==================== MIDDLEWARE ====================

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
);

// Compression middleware
app.use(compression());

// CORS configuration
app.use(
  cors({
    origin:
      config.NODE_ENV === "production"
        ? [
            "https://yourdomain.com",
            "https://admin.yourdomain.com",
            "https://api.yourdomain.com",
          ]
        : "*",
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-tenant-id",
      "X-tenant-subdomain",
      "Accept",
    ],
    exposedHeaders: ["X-Total-Count", "X-Page", "X-Limit"],
  }),
);

// Logging middleware
if (config.NODE_ENV !== "production") {
  app.use(morgan("dev"));
} else {
  app.use(
    morgan("combined", {
      stream: {
        write: (message) => logger.info(message.trim()),
      },
    }),
  );
}

// Body parsing middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Static files serving
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/static", express.static(path.join(__dirname, "../public")));

// Request logging middleware (for debugging)
app.use((req, res, next) => {
  if (config.NODE_ENV === "development") {
    logger.debug(`${req.method} ${req.url} - Body:`, req.body);
  }
  next();
});

// ==================== HEALTH CHECK ENDPOINTS ====================

// Basic health check
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version,
  });
});

// Detailed health check
app.get("/health/detailed", async (req, res) => {
  const health = {
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.NODE_ENV,
    memory: {
      rss: process.memoryUsage().rss,
      heapTotal: process.memoryUsage().heapTotal,
      heapUsed: process.memoryUsage().heapUsed,
      external: process.memoryUsage().external,
    },
    database: "checking...",
  };

  try {
    const db = require("./config/db");
    const pool = db.getPool();
    await pool.query("SELECT 1");
    health.database = "connected";
  } catch (error) {
    health.database = "disconnected";
    health.status = "DEGRADED";
  }

  res.status(200).json(health);
});

// Root endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    name: "GasFlow ERP SaaS",
    version: "1.0.0",
    status: "running",
    documentation: "/api/docs",
    endpoints: {
      auth: "/api/auth",
      superadmin: "/api/superadmin",
      master:
        "/api/countries, /api/states, /api/cities, /api/pincodes, /api/brands, /api/cylinder-types, /api/cylinder-rates",
      business:
        "/api/customers, /api/dealers, /api/stock, /api/invoices, /api/expenses, /api/reports, /api/dashboard, /api/staff, /api/inventory,/api/orders, /api/documents, /api/subscriptions",
    },
  });
});

// ==================== API ROUTES ====================

// Authentication Routes (Public)
app.use("/api/auth", authRoutes);

// Superadmin Routes (Protected - Superadmin only)
app.use("/api/superadmin", superadminRoutes);

// Master Data Routes (Public GET, Protected POST/PUT/DELETE)
app.use("/api/countries", countryRoutes);
app.use("/api/states", stateRoutes);
app.use("/api/cities", cityRoutes);
app.use("/api/pincodes", pincodeRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/cylinder-types", cylinderTypeRoutes);
app.use("/api/cylinder-rates", cylinderRateRoutes);

// Tenant Business Routes (Protected - Tenant users only)
app.use("/api/customers", customerRoutes);
app.use("/api/dealers", dealerRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/users", userRoutes);
app.use("/api/tenant", tenantRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/superadmin/plans", superadminPlansRoutes);
app.use("/api/cylinders", cylinderRoutes);


// ==================== API DOCUMENTATION ====================

// Simple API documentation endpoint
app.get("/api/docs", (req, res) => {
  res.status(200).json({
    name: "GasFlow ERP SaaS API",
    version: "1.0.0",
    base_url: `${req.protocol}://${req.get("host")}/api`,
    authentication: {
      login: "POST /api/auth/login",
      logout: "POST /api/auth/logout",
      change_password: "POST /api/auth/change-password",
      profile: "GET /api/auth/profile",
    },
    superadmin: {
      tenants: {
        list: "GET /api/superadmin/tenants",
        create: "POST /api/superadmin/tenants",
        get: "GET /api/superadmin/tenants/:id",
        update: "PUT /api/superadmin/tenants/:id",
        delete: "DELETE /api/superadmin/tenants/:id",
        database_info: "GET /api/superadmin/tenants/:id/database",
        backup: "POST /api/superadmin/tenants/:id/backup",
      },
    },
    master_data: {
      countries:
        "GET /api/countries, POST /api/countries, PUT /api/countries/:id, DELETE /api/countries/:id, PATCH /api/countries/toggle-status/:id",
      states:
        "GET /api/states, POST /api/states, PUT /api/states/:id, DELETE /api/states/:id",
      cities:
        "GET /api/cities, POST /api/cities, PUT /api/cities/:id, DELETE /api/cities/:id",
      pincodes:
        "GET /api/pincodes, POST /api/pincodes, PUT /api/pincodes/:id, DELETE /api/pincodes/:id,GET /api/pincodes/ :pincode",
      brands:
        "GET /api/brands, POST /api/brands, PUT /api/brands/:id, DELETE /api/brands/:id",
      cylinder_types:
        "GET /api/cylinder-types, POST /api/cylinder-types, PUT /api/cylinder-types/:id, DELETE /api/cylinder-types/:id",
      cylinder_rates:
        "GET /api/cylinder-rates, POST /api/cylinder-rates, PUT /api/cylinder-rates/:id, DELETE /api/cylinder-rates/:id",
    },
    business: {
      customers:
        "GET /api/customers, POST /api/customers, PUT /api/customers/:id, DELETE /api/customers/:id",
      dealers:
        "GET /api/dealers, POST /api/dealers, PUT /api/dealers/:id, DELETE /api/dealers/:id",
      stock:
        "GET /api/stock, POST /api/stock, PUT /api/stock/:id, DELETE /api/stock/:id",
      invoices:
        "GET /api/invoices, POST /api/invoices, PUT /api/invoices/:id, DELETE /api/invoices/:id",
      expenses:
        "GET /api/expenses, POST /api/expenses, PUT /api/expenses/:id, DELETE /api/expenses/:id",
      reports:
        "GET /api/reports/sales, GET /api/reports/stock, GET /api/reports/financial",
      dashboard: "GET /api/dashboard/stats, GET /api/dashboard/charts",
      staff:
        "GET /api/staff, POST /api/staff, PUT /api/staff/:id, DELETE /api/staff/:id, GET /api/staff/:id/activity, PATCH /api/staff/:id/reset-password",
      inventory:
        "GET /api/inventory, POST /api/inventory, PUT /api/inventory/:id, DELETE /api/inventory/:id, POST /api/inventory/stock/transactions, GET /api/inventory/stock/transactions/:productId, POST /api/inventory/stock/adjust, GET /api/inventory/alerts, PUT /api/inventory/alerts/:id/resolve, POST /api/inventory/transfers, PUT /api/inventory/transfers/:id/complete, GET /api/inventory/summary",

      orders:
        "GET /api/orders, POST /api/orders, GET /api/orders/:id, PUT /api/orders/:id/status, PUT /api/orders/:id/payment, POST /api/orders/:id/cancel, DELETE /api/orders/:id",

      documents:
        "POST /api/documents, GET /api/documents, GET /api/documents/:id, GET /api/documents/:id/download, GET /api/documents/entity/:entityType/:entityId, PUT /api/documents/:id, DELETE /api/documents/:id, GET /api/documents/categories/:entityType, GET /api/documents/statistics",

      subscriptions:
        "POST /api/subscriptions, GET /api/subscriptions, GET /api/subscriptions/:id, GET /api/subscriptions/statistics, GET /api/subscriptions/tenant, POST /api/subscriptions/:id/renew, POST /api/subscriptions/:id/cancel, POST /api/subscriptions/:id/payments, POST /api/subscriptions/update-expired",
    },
  });
});

// ==================== ERROR HANDLING ====================

// 404 Handler - Catch all unmatched routes
app.use(ErrorMiddleware.notFound);

// Global error handler
app.use(ErrorMiddleware.errorHandler);

// Graceful shutdown handler
process.on("SIGTERM", () => {
  logger.info("SIGTERM signal received: closing HTTP server");
  if (app.server) {
    app.server.close(() => {
      logger.info("HTTP server closed");
    });
  }
});

module.exports = app;
