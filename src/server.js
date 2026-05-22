const app = require("./app");
const config = require("./config/env");
const logger = require("./config/logger");
const db = require("./config/db");
const DatabaseManager = require("./services/database-manager.service");

const PORT = config.PORT || 5000;
let server = null;

// ==================== PROCESS HANDLERS ====================

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", {
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });

  // Graceful shutdown on uncaught exception
  logger.info("Attempting graceful shutdown...");
  gracefulShutdown()
    .then(() => {
      process.exit(1);
    })
    .catch(() => {
      process.exit(1);
    });
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection:", {
    reason: reason.message || reason,
    stack: reason.stack,
    promise: promise,
    timestamp: new Date().toISOString(),
  });

  // Graceful shutdown on unhandled rejection
  logger.info("Attempting graceful shutdown...");
  gracefulShutdown()
    .then(() => {
      process.exit(1);
    })
    .catch(() => {
      process.exit(1);
    });
});

// Handle warnings
process.on("warning", (warning) => {
  logger.warn("Process Warning:", {
    name: warning.name,
    message: warning.message,
    stack: warning.stack,
  });
});

// ==================== GRACEFUL SHUTDOWN ====================

const gracefulShutdown = async () => {
  logger.info("Received shutdown signal, closing server...");

  const shutdownTimeout = setTimeout(() => {
    logger.error(
      "Could not close connections in time, forcefully shutting down",
    );
    process.exit(1);
  }, 30000); // 30 seconds timeout

  try {
    // Close HTTP server
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      logger.info("HTTP server closed");
    }

    // Close database connections
    await db.disconnect();
    logger.info("Main database connections closed");

    // Close any other connections if needed
    // await redis.disconnect();
    // await rabbitmq.disconnect();

    clearTimeout(shutdownTimeout);
    logger.info("Graceful shutdown completed successfully");
    process.exit(0);
  } catch (error) {
    logger.error("Error during graceful shutdown:", error);
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
};

// ==================== START SERVER ====================

const startServer = async () => {
  try {
    logger.info("Starting GasFlow ERP SaaS Server...");
    logger.info(`Environment: ${config.NODE_ENV}`);
    logger.info(`Node Version: ${process.version}`);
    logger.info(`Platform: ${process.platform}`);

    // Connect to main database
    await db.connect();
    logger.info("✓ Main database connected successfully");

    // Initialize database manager
    await DatabaseManager.init();
    logger.info("✓ Database manager initialized");

    // Verify tenant database template
    await DatabaseManager.loadTemplateSchema();
    logger.info("✓ Tenant database template loaded");

    // Start HTTP server
    server = app.listen(PORT, () => {
      logger.info(`✓ Server started successfully`);
      logger.info(`========================================`);
      logger.info(`Environment: ${config.NODE_ENV}`);
      logger.info(`Server URL: http://localhost:${PORT}`);
      logger.info(`API URL: http://localhost:${PORT}/api`);
      logger.info(`Health Check: http://localhost:${PORT}/health`);
      logger.info(`API Docs: http://localhost:${PORT}/api/docs`);
      logger.info(`========================================`);

      // Log available endpoints
      if (config.NODE_ENV === "development") {
        logger.debug("Available endpoints:");
        logger.debug("  GET  /health");
        logger.debug("  GET  /health/detailed");
        logger.debug("  POST /api/auth/login");
        logger.debug("  GET  /api/auth/profile");
        logger.debug("  GET  /api/superadmin/tenants");
        logger.debug("  GET  /api/countries");
        logger.debug("  GET  /api/customers");
        logger.debug("  GET  /api/dealers");
        logger.debug("  GET  /api/stock");
        logger.debug("  GET  /api/invoices");
        logger.debug("  GET  /api/reports");
        logger.debug("  GET  /api/dashboard/stats");
        logger.debug("  GET /api/staff ");
      }
    });

    // Handle server errors
    server.on("error", (error) => {
      logger.error("Server error:", error);
      if (error.code === "EADDRINUSE") {
        logger.error(
          `Port ${PORT} is already in use. Please use a different port or kill the process using this port.`,
        );
        process.exit(1);
      }
    });

    // Set server timeout
    server.timeout = 300000; // 5 minutes
    server.keepAliveTimeout = 60000; // 1 minute

    // Store server instance for graceful shutdown
    app.server = server;
  } catch (error) {
    logger.error("Failed to start server:", error);

    // Log detailed error for debugging
    if (error.code === "ECONNREFUSED") {
      logger.error(
        "Database connection refused. Please check if MySQL is running and credentials are correct.",
      );
    } else if (error.code === "ER_ACCESS_DENIED_ERROR") {
      logger.error(
        "Database access denied. Please check username and password.",
      );
    } else if (error.code === "ER_BAD_DB_ERROR") {
      logger.error(
        "Database does not exist. Please run database migrations first.",
      );
    }

    process.exit(1);
  }
};

// ==================== SIGNAL HANDLERS ====================

// Handle SIGTERM signal (from docker, kubernetes, etc.)
process.on("SIGTERM", () => {
  logger.info("SIGTERM signal received");
  gracefulShutdown();
});

// Handle SIGINT signal (Ctrl+C)
process.on("SIGINT", () => {
  logger.info("SIGINT signal received");
  gracefulShutdown();
});

// Handle SIGHUP signal
process.on("SIGHUP", () => {
  logger.info("SIGHUP signal received");
  gracefulShutdown();
});

// ==================== START APPLICATION ====================

// Start the server
startServer().catch((error) => {
  logger.error("Unhandled error during startup:", error);
  process.exit(1);
});

// ==================== EXPORT FOR TESTING ====================

module.exports = { app, server };
