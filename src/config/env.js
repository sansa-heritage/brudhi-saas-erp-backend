const dotenv = require('dotenv');
const path = require('path');

// Load environment file based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' :
                process.env.NODE_ENV === 'staging' ? '.env.staging' : '.env.development';

dotenv.config({ path: path.join(__dirname, '../../', envFile) });
dotenv.config({ path: path.join(__dirname, '../../', '.env') });

const config = {
  // Server
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,
  
  // Main Database
  MAIN_DB: {
    HOST: process.env.MAIN_DB_HOST,
    PORT: parseInt(process.env.MAIN_DB_PORT, 10) || 3306,
    USER: process.env.MAIN_DB_USER,
    PASSWORD: process.env.MAIN_DB_PASSWORD,
    NAME: process.env.MAIN_DB_NAME,
  },
  
  // Root Database (for creating tenant databases)
  ROOT_DB: {
    HOST: process.env.DB_ROOT_HOST || process.env.MAIN_DB_HOST,
    PORT: parseInt(process.env.DB_ROOT_PORT, 10) || parseInt(process.env.MAIN_DB_PORT, 10) || 3306,
    USER: process.env.DB_ROOT_USER || process.env.MAIN_DB_USER,
    PASSWORD: process.env.DB_ROOT_PASSWORD || process.env.MAIN_DB_PASSWORD,
  },
  
  // JWT
  JWT: {
    SECRET: process.env.JWT_SECRET,
    EXPIRE: process.env.JWT_EXPIRE || '7d',
  },
  
  // Email
  EMAIL: {
    HOST: process.env.EMAIL_HOST,
    PORT: parseInt(process.env.EMAIL_PORT, 10) || 587,
    USER: process.env.EMAIL_USER,
    PASS: process.env.EMAIL_PASS,
  },
  
  // Upload
  UPLOAD: {
    PATH: process.env.UPLOAD_PATH || './uploads',
    MAX_SIZE: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024,
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'],
  },
};

// Validate required config
const required = ['MAIN_DB.HOST', 'MAIN_DB.USER', 'MAIN_DB.PASSWORD', 'MAIN_DB.NAME', 'JWT.SECRET'];
for (const key of required) {
  const value = key.split('.').reduce((obj, k) => obj?.[k], config);
  if (!value && config.NODE_ENV !== 'test') {
    throw new Error(`Missing required configuration: ${key}`);
  }
}

module.exports = config;