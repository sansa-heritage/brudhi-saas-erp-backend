const mysql = require('mysql2/promise');
const config = require('./env');
const logger = require('./logger');

class Database {
    constructor() {
        this.pool = null;
        this.connectionStatus = 'disconnected';
    }

    async connect() {
        try {
            this.pool = mysql.createPool({
                host: config.MAIN_DB.HOST,
                port: config.MAIN_DB.PORT,
                user: config.MAIN_DB.USER,
                password: config.MAIN_DB.PASSWORD,
                database: config.MAIN_DB.NAME,
                waitForConnections: true,
                connectionLimit: 20,
                queueLimit: 0,
                enableKeepAlive: true,
                keepAliveInitialDelay: 0,
                timezone: '+00:00',
                charset: 'utf8mb4',
                multipleStatements: false,
                supportBigNumbers: true,
                bigNumberStrings: false
            });

            // Test connection
            const connection = await this.pool.getConnection();
            this.connectionStatus = 'connected';
            logger.info(`Main database connected: ${config.MAIN_DB.NAME}@${config.MAIN_DB.HOST}`);
            connection.release();
            
            // Handle pool errors
            this.pool.on('error', (err) => {
                logger.error('Database pool error:', err);
                this.connectionStatus = 'error';
                if (err.code === 'PROTOCOL_CONNECTION_LOST') {
                    logger.info('Attempting to reconnect...');
                    this.reconnect();
                }
            });
            
            return this.pool;
        } catch (error) {
            this.connectionStatus = 'disconnected';
            logger.error('Main database connection failed:', error);
            throw error;
        }
    }

    async reconnect() {
        try {
            logger.info('Reconnecting to database...');
            await this.disconnect();
            await this.connect();
            logger.info('Reconnected to database successfully');
        } catch (error) {
            logger.error('Failed to reconnect:', error);
            setTimeout(() => this.reconnect(), 5000);
        }
    }

    getPool() {
        if (!this.pool) {
            throw new Error('Database not initialized. Call connect() first.');
        }
        if (this.connectionStatus !== 'connected') {
            throw new Error('Database not connected. Status: ' + this.connectionStatus);
        }
        return this.pool;
    }

    async query(sql, params = []) {
        try {
            const startTime = Date.now();
            const [rows] = await this.pool.query(sql, params);
            const duration = Date.now() - startTime;
            
            if (duration > 1000) {
                logger.warn('Slow query detected:', { sql, params, duration });
            }
            
            return rows;
        } catch (error) {
            logger.error('Query error:', { sql, params, error: error.message });
            throw error;
        }
    }

    async execute(sql, params = []) {
        try {
            const [rows] = await this.pool.execute(sql, params);
            return rows;
        } catch (error) {
            logger.error('Execute error:', { sql, params, error: error.message });
            throw error;
        }
    }

    async transaction(callback) {
        const connection = await this.pool.getConnection();
        await connection.beginTransaction();
        
        try {
            const result = await callback(connection);
            await connection.commit();
            return result;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async disconnect() {
        if (this.pool) {
            await this.pool.end();
            this.connectionStatus = 'disconnected';
            logger.info('Database connection closed');
        }
    }

    getStatus() {
        return {
            status: this.connectionStatus,
            pool: this.pool ? {
                totalConnections: this.pool._allConnections?.length || 0,
                freeConnections: this.pool._freeConnections?.length || 0,
                queueLength: this.pool._connectionQueue?.length || 0
            } : null
        };
    }
}

module.exports = new Database();