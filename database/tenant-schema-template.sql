-- ============================================
-- TENANT DATABASE TEMPLATE
-- This schema is copied for each tenant
-- ============================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'staff', 'manager') NOT NULL DEFAULT 'staff',
    mobile VARCHAR(20),
    profile_image VARCHAR(255),
    last_login DATETIME,
    last_login_ip VARCHAR(50),
    login_attempts INT DEFAULT 0,
    locked_until DATETIME,
    status ENUM('active', 'inactive', 'blocked') DEFAULT 'active',
    email_verified BOOLEAN DEFAULT FALSE,
    mobile_verified BOOLEAN DEFAULT FALSE,
    reset_token VARCHAR(255),
    reset_token_expires DATETIME,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_status (status),
    INDEX idx_role (role)
);

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_name (name)
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    module VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_module_action (module, action)
);

-- Role permissions
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_code VARCHAR(50) UNIQUE,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    mobile VARCHAR(20) NOT NULL,
    alternate_mobile VARCHAR(20),
    country_id INT,
    state_id INT,
    city_id INT,
    pincode_id INT,
    address TEXT,
    landmark VARCHAR(255),
    gst_number VARCHAR(50),
    pan_number VARCHAR(20),
    aadhaar_number VARCHAR(20),
    customer_type ENUM('regular', 'corporate', 'bulk') DEFAULT 'regular',
    credit_limit DECIMAL(10, 2) DEFAULT 0,
    credit_days INT DEFAULT 0,
    outstanding_amount DECIMAL(10, 2) DEFAULT 0,
    status ENUM('active', 'inactive', 'blocked') DEFAULT 'active',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_mobile (mobile),
    INDEX idx_status (status),
    INDEX idx_customer_code (customer_code),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Dealers table
CREATE TABLE IF NOT EXISTS dealers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dealer_code VARCHAR(50) UNIQUE,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    mobile VARCHAR(20) NOT NULL,
    alternate_mobile VARCHAR(20),
    country_id INT,
    state_id INT,
    city_id INT,
    pincode_id INT,
    address TEXT,
    gst_number VARCHAR(50),
    pan_number VARCHAR(20),
    aadhaar_number VARCHAR(20),
    dealer_type ENUM('distributor', 'retailer', 'sub-dealer') DEFAULT 'retailer',
    commission_rate DECIMAL(5, 2) DEFAULT 0,
    status ENUM('active', 'inactive', 'blocked') DEFAULT 'active',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_mobile (mobile),
    INDEX idx_dealer_code (dealer_code),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Cylinder types (customizable per tenant)
CREATE TABLE IF NOT EXISTS cylinder_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    weight DECIMAL(5, 2) NOT NULL,
    type ENUM('Domestic', 'Commercial', 'Industrial') NOT NULL,
    capacity_kg DECIMAL(5, 2),
    price DECIMAL(10, 2),
    gst_percent DECIMAL(5, 2) DEFAULT 5.00,
    description TEXT,
    status TINYINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_type (type),
    INDEX idx_status (status)
);

-- Gas stock
CREATE TABLE IF NOT EXISTS gas_stocks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cylinder_type_id INT NOT NULL,
    brand_id INT,
    total_stock INT NOT NULL DEFAULT 0,
    available_stock INT NOT NULL DEFAULT 0,
    damaged_stock INT DEFAULT 0,
    returned_stock INT DEFAULT 0,
    reserved_stock INT DEFAULT 0,
    min_stock_level INT DEFAULT 10,
    max_stock_level INT DEFAULT 1000,
    reorder_level INT DEFAULT 50,
    last_updated_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cylinder_type_id) REFERENCES cylinder_types(id),
    FOREIGN KEY (last_updated_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_cylinder_brand (cylinder_type_id, brand_id),
    INDEX idx_stock_level (available_stock, reorder_level)
);

-- Stock transactions
CREATE TABLE IF NOT EXISTS stock_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stock_id INT NOT NULL,
    transaction_type ENUM('purchase', 'sale', 'return', 'damage', 'adjustment', 'transfer') NOT NULL,
    quantity INT NOT NULL,
    previous_stock INT,
    new_stock INT,
    reference_type VARCHAR(50),
    reference_id INT,
    remarks TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stock_id) REFERENCES gas_stocks(id),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_transaction_type (transaction_type),
    INDEX idx_created_at (created_at)
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_no VARCHAR(50) NOT NULL UNIQUE,
    invoice_date DATE NOT NULL,
    due_date DATE,
    party_type ENUM('customer', 'dealer') NOT NULL,
    party_id INT NOT NULL,
    party_name VARCHAR(150),
    party_gst VARCHAR(50),
    party_address TEXT,
    subtotal DECIMAL(10, 2) NOT NULL,
    discount_type ENUM('percentage', 'fixed') DEFAULT 'fixed',
    discount_value DECIMAL(10, 2) DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    taxable_amount DECIMAL(10, 2) NOT NULL,
    gst_amount DECIMAL(10, 2) NOT NULL,
    cess_amount DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL,
    round_off DECIMAL(10, 2) DEFAULT 0,
    net_amount DECIMAL(10, 2) NOT NULL,
    payment_status ENUM('paid', 'unpaid', 'partial', 'overdue') DEFAULT 'unpaid',
    paid_amount DECIMAL(10, 2) DEFAULT 0,
    balance_amount DECIMAL(10, 2) DEFAULT 0,
    payment_method VARCHAR(50),
    transaction_id VARCHAR(100),
    notes TEXT,
    terms_conditions TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_party (party_type, party_id),
    INDEX idx_invoice_date (invoice_date),
    INDEX idx_payment_status (payment_status),
    INDEX idx_invoice_no (invoice_no)
);

-- Invoice items
CREATE TABLE IF NOT EXISTS invoice_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL,
    cylinder_type_id INT NOT NULL,
    brand_id INT,
    quantity INT NOT NULL,
    rate DECIMAL(10, 2) NOT NULL,
    discount_percent DECIMAL(5, 2) DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    taxable_amount DECIMAL(10, 2) NOT NULL,
    gst_percent DECIMAL(5, 2) NOT NULL,
    gst_amount DECIMAL(10, 2) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (cylinder_type_id) REFERENCES cylinder_types(id),
    INDEX idx_invoice (invoice_id)
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL,
    payment_date DATE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    transaction_id VARCHAR(100),
    reference_no VARCHAR(100),
    notes TEXT,
    received_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_invoice (invoice_id),
    INDEX idx_payment_date (payment_date)
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    expense_date DATE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL,
    description TEXT,
    reference_no VARCHAR(100),
    receipt_path VARCHAR(255),
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_expense_date (expense_date),
    INDEX idx_category (category)
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entity_type ENUM('customer', 'dealer', 'user') NOT NULL,
    entity_id INT NOT NULL,
    doc_type ENUM('PAN', 'AADHAAR', 'GST', 'VOTER', 'CERTIFICATE', 'OTHER') NOT NULL,
    doc_number VARCHAR(100),
    file_name VARCHAR(255),
    file_path VARCHAR(500) NOT NULL,
    file_size INT,
    mime_type VARCHAR(100),
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by INT,
    verified_at DATETIME,
    expiry_date DATE,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_doc_type (doc_type)
);

-- Activity logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    module VARCHAR(100) NOT NULL,
    action VARCHAR(255) NOT NULL,
    description TEXT,
    old_data JSON,
    new_data JSON,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_module (module),
    INDEX idx_created_at (created_at),
    INDEX idx_user (user_id)
);

-- Login logs
CREATE TABLE IF NOT EXISTS login_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    email VARCHAR(150),
    ip_address VARCHAR(50),
    user_agent TEXT,
    login_status ENUM('success', 'failed') NOT NULL,
    failure_reason VARCHAR(255),
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user (user_id),
    INDEX idx_login_time (login_time),
    INDEX idx_status (login_status)
);

-- Usage tracking
CREATE TABLE IF NOT EXISTS usage_tracking (
    id INT AUTO_INCREMENT PRIMARY KEY,
    month_year VARCHAR(7) NOT NULL,
    invoices_used INT DEFAULT 0,
    users_used INT DEFAULT 0,
    customers_used INT DEFAULT 0,
    dealers_used INT DEFAULT 0,
    stock_transactions INT DEFAULT 0,
    storage_used_mb DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_month (month_year)
);

-- Insert default roles
INSERT INTO roles (name, description, is_system) VALUES 
('admin', 'Administrator with full access', true),
('staff', 'Staff with limited access', true),
('manager', 'Manager with moderate access', true);

-- Insert default permissions
INSERT INTO permissions (module, action, description) VALUES
('dashboard', 'view', 'View dashboard'),
('customers', 'create', 'Create customers'),
('customers', 'read', 'Read customers'),
('customers', 'update', 'Update customers'),
('customers', 'delete', 'Delete customers'),
('dealers', 'create', 'Create dealers'),
('dealers', 'read', 'Read dealers'),
('dealers', 'update', 'Update dealers'),
('dealers', 'delete', 'Delete dealers'),
('invoices', 'create', 'Create invoices'),
('invoices', 'read', 'Read invoices'),
('invoices', 'update', 'Update invoices'),
('invoices', 'delete', 'Delete invoices'),
('invoices', 'payment', 'Process payments'),
('stock', 'create', 'Add stock'),
('stock', 'read', 'View stock'),
('stock', 'update', 'Update stock'),
('stock', 'delete', 'Delete stock'),
('expenses', 'create', 'Create expenses'),
('expenses', 'read', 'Read expenses'),
('expenses', 'update', 'Update expenses'),
('expenses', 'delete', 'Delete expenses'),
('reports', 'view', 'View reports'),
('reports', 'export', 'Export reports'),
('settings', 'view', 'View settings'),
('settings', 'update', 'Update settings');

-- Assign all permissions to admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'admin';


-- ============================================
-- MASTER DATA TABLES
-- ============================================

-- Countries table
-- Create countries table
CREATE TABLE IF NOT EXISTS `countries` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `code` VARCHAR(10) DEFAULT NULL,
  `status` TINYINT DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

-- Create states table
CREATE TABLE IF NOT EXISTS `states` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `country_id` INT NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `code` VARCHAR(10) DEFAULT NULL,
  `status` TINYINT DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE CASCADE
);

-- Create cities table
CREATE TABLE IF NOT EXISTS `cities` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `state_id` INT NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `code` VARCHAR(10) DEFAULT NULL,
  `status` TINYINT DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`state_id`) REFERENCES `states`(`id`) ON DELETE CASCADE
);

-- Create pincodes table
CREATE TABLE IF NOT EXISTS `pincodes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `city_id` INT NOT NULL,
  `code` VARCHAR(10) NOT NULL,
  `area` VARCHAR(255) DEFAULT NULL,
  `status` TINYINT DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS brands (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    logo VARCHAR(255),
    description TEXT,
    status TINYINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status)
);

-- Create cylinder_rates table in tenant database
CREATE TABLE IF NOT EXISTS `cylinder_rates` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `brand_id` INT NOT NULL,
  `cylinder_type_id` INT NOT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `gst_percent` DECIMAL(5,2) DEFAULT 0.00,
  `cess` DECIMAL(10,2) DEFAULT 0.00,
  `effective_from` DATE NOT NULL,
  `effective_to` DATE DEFAULT NULL,
  `is_current` TINYINT DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_brand_id` (`brand_id`),
  KEY `idx_cylinder_type_id` (`cylinder_type_id`),
  KEY `idx_is_current` (`is_current`)
);

-- Insert sample data for India
INSERT INTO `countries` (`name`, `code`, `status`) VALUES 
('India', 'IN', 1),
('United States', 'US', 1),
('United Kingdom', 'UK', 1),
('Canada', 'CA', 1),
('Australia', 'AU', 1);

-- Insert states for India
INSERT INTO `states` (`country_id`, `name`, `code`, `status`) VALUES 
(1, 'Maharashtra', 'MH', 1),
(1, 'Delhi', 'DL', 1),
(1, 'Karnataka', 'KA', 1),
(1, 'Tamil Nadu', 'TN', 1),
(1, 'Gujarat', 'GJ', 1),
(1, 'Uttar Pradesh', 'UP', 1),
(1, 'West Bengal', 'WB', 1),
(1, 'Rajasthan', 'RJ', 1);

-- Insert cities for Maharashtra
INSERT INTO `cities` (`state_id`, `name`, `code`, `status`) VALUES 
(1, 'Mumbai', 'MUM', 1),
(1, 'Pune', 'PUN', 1),
(1, 'Nagpur', 'NAG', 1),
(1, 'Nashik', 'NAS', 1);

-- Insert pincodes for Mumbai
INSERT INTO `pincodes` (`city_id`, `name`, `code`, `status`) VALUES 
(1, 'Mumbai CST', '400001', 1),
(1, 'Fort', '400002', 1),
(1, 'Marine Lines', '400003', 1),
(1, 'Charni Road', '400004', 1),
(1, 'Grant Road', '400005', 1),
(1, 'Mumbai Central', '400008', 1),
(1, 'Dadar', '400014', 1),
(1, 'Bandra', '400050', 1),
(1, 'Andheri', '400053', 1),
(1, 'Juhu', '400049', 1);

INSERT INTO `brands` (`name`, `code`, `logo`, `description`, `status`) VALUES 
('Indane', 'IND', '/logos/indane.png', 'Indane is a brand of liquefied petroleum gas marketed by Indian Oil Corporation Limited', 1),
('Bharat Gas', 'BHG', '/logos/bharat-gas.png', 'Bharat Gas is a brand of liquefied petroleum gas marketed by Bharat Petroleum Corporation Limited', 1),
('HP Gas', 'HPG', '/logos/hp-gas.png', 'HP Gas is a brand of liquefied petroleum gas marketed by Hindustan Petroleum Corporation Limited', 1),
('Total Gas', 'TLG', '/logos/total-gas.png', 'Total Gas is a brand of liquefied petroleum gas marketed by TotalEnergies', 1),
('Reliance Gas', 'RLG', '/logos/reliance-gas.png', 'Reliance Gas is a brand of liquefied petroleum gas marketed by Reliance Industries', 1);