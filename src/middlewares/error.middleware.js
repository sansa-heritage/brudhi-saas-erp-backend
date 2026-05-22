const logger = require('../config/logger');
const ResponseUtil = require('../utils/response');

// Import config dynamically to avoid circular dependency
let config;
try {
    config = require('../config/env');
} catch (err) {
    // If config is not available, use default
    config = { NODE_ENV: 'development' };
}

class ErrorMiddleware {
    static notFound(req, res, next) {
        const error = new Error(`Not Found - ${req.originalUrl}`);
        error.status = 404;
        next(error);
    }

    static errorHandler(err, req, res, next) {
        let error = { ...err };
        error.message = err.message;

        // Log error with context
        logger.error({
            message: err.message,
            stack: err.stack,
            status: err.status || 500,
            url: req.originalUrl,
            method: req.method,
            ip: req.ip,
            user: req.user?.id,
            tenant: req.tenantId,
            body: req.method !== 'GET' ? req.body : undefined
        });

        // Handle specific error types
        if (err.code === 'ER_DUP_ENTRY') {
            error.message = 'Duplicate field value entered';
            error.status = 400;
        }

        if (err.code === 'ER_NO_REFERENCED_ROW_2') {
            error.message = 'Invalid reference: referenced record does not exist';
            error.status = 400;
        }

        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            error.message = 'Cannot delete record because it is referenced by other records';
            error.status = 400;
        }

        if (err.name === 'JsonWebTokenError') {
            error.message = 'Invalid token';
            error.status = 401;
        }

        if (err.name === 'TokenExpiredError') {
            error.message = 'Token expired';
            error.status = 401;
        }

        if (err.name === 'ValidationError') {
            error.message = 'Validation error';
            error.status = 422;
        }

        if (err.code === 'LIMIT_FILE_SIZE') {
            error.message = 'File too large';
            error.status = 400;
        }

        if (err.code === 'ENOENT') {
            error.message = 'File not found';
            error.status = 404;
        }

        // Send response
        const statusCode = error.status || 500;
        const message = error.message || 'Server Error';

        res.status(statusCode).json({
            success: false,
            message,
            code: error.code,
            errors: error.errors,
            stack: config && config.NODE_ENV === 'development' ? err.stack : undefined,
            timestamp: new Date().toISOString(),
            path: req.originalUrl,
            method: req.method
        });
    }
}

module.exports = ErrorMiddleware;