# gasflow-erp-saas

# 🚀 GasFlow ERP SaaS (Cylintra)

A **Multi-Tenant SaaS-based Gas Agency Management System** built with **Node.js, Express, MySQL, and React**.

This platform helps gas agencies manage:

* 📦 Stock (Cylinders)
* 🧾 Invoices & GST Billing
* 👥 Customers & Dealers
* 💰 Expenses & Profit Tracking
* 📊 Reports & Dashboard
* 🏢 Multi-tenant SaaS (multiple agencies)

---

# 🌟 Features

## 🏢 SaaS Features

* Multi-Tenant Architecture (Each agency = separate data)
* Subscription Plans & Usage Tracking
* Module-based Access Control
* Super Admin Panel
* Tenant Isolation (secure data separation)

---

## 👑 Super Admin

* Manage all tenants
* Assign subscription plans
* Enable/Disable modules
* Monitor usage (users, invoices)
* View logs & system activity

---

## 🏢 Tenant Admin (Gas Agency)

* Dashboard (Sales, Expenses, Stock)
* Customer Management
* Dealer Management
* Gas Stock Management
* Invoice & GST Billing
* Expense Tracking
* Reports & Analytics
* Staff Management

---

## 👨‍💼 Staff Role

* Create Invoices
* View Customers
* Limited module access

---

# 🏗️ Tech Stack

### Backend

* Node.js
* Express.js
* MySQL
* JWT Authentication
* Bcrypt (Password Hashing)

### Frontend

* React.js
* Bootstrap

---

# 📁 Project Structure

```
gas-agency-backend/
│
├── src/
│   ├── config/
│   ├── middlewares/
│   ├── modules/
│   ├── services/
│   ├── repositories/
│   ├── utils/
│   ├── jobs/
│   ├── app.js
│   ├── server.js
│
├── logs/
├── uploads/
├── .env
├── package.json
```

---

# 🗄️ Database Design

Core Tables:

* tenants
* users
* plans
* tenant_subscriptions
* modules
* tenant_modules
* customers
* dealers
* gas_stocks
* invoices
* invoice_items
* expenses
* usage_tracking
* activity_logs
* email_logs
* login_logs

---

# 🔐 Authentication Flow

1. User Login
2. JWT Token Generated
3. Token includes:

```
{
  userId,
  tenant_id,
  role
}
```

4. Middleware verifies:

* Authentication
* Tenant access
* Role permissions

---

# 🧾 Invoice Logic

```
Subtotal = Σ (quantity × rate)
GST = subtotal × GST%
Total = subtotal + GST
```

Stock is automatically reduced after invoice creation.

---

# 📦 Stock Logic

* Add Stock → Increase available_stock
* Create Invoice → Decrease available_stock
* Low Stock Alert when below threshold

---

# 📊 Dashboard Metrics

* Total Sales
* Total Expenses
* Net Profit
* Pending Invoices
* Stock Availability

---

# 🌐 API Endpoints

## 🔐 Auth

* POST /api/v1/auth/register-tenant
* POST /api/v1/auth/login

## 👥 Customers

* GET /api/v1/customers
* POST /api/v1/customers

## 🧾 Invoices

* POST /api/v1/invoices
* GET /api/v1/invoices

## 📦 Stock

* GET /api/v1/stocks
* POST /api/v1/stocks/add

## 💰 Expenses

* GET /api/v1/expenses
* POST /api/v1/expenses

## 📊 Dashboard

* GET /api/v1/dashboard/summary

---

# ⚙️ Setup Instructions

## 1️⃣ Clone Repository

```bash
git clone https://github.com/your-username/gasflow-erp-saas.git
cd gasflow-erp-saas
```

---

## 2️⃣ Install Dependencies

```bash
npm install
```

---

## 3️⃣ Configure Environment

Create `.env` file:

```
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=gas_agency_saas
JWT_SECRET=your_secret_key
```

---

## 4️⃣ Run Server

```bash
npm run dev
```

---

# 🔒 Security Features

* JWT Authentication
* Password Hashing (bcrypt)
* Role-Based Access Control
* Tenant Isolation
* Input Validation
* API Logging

---

# 📧 Email System

Supports:

* Welcome Emails
* Invoice Emails
* Payment Reminders
* Subscription Alerts

---

# 📊 Logging System

* Activity Logs
* Login Logs
* Email Logs

---

# 💳 SaaS Subscription Model

| Plan     | Price | Features                 |
| -------- | ----- | ------------------------ |
| Basic    | ₹999  | Limited users & invoices |
| Standard | ₹1999 | Full ERP features        |
| Premium  | ₹3999 | Unlimited + analytics    |

---

# 🚀 Future Enhancements

* Payment Gateway Integration
* WhatsApp Notifications
* Mobile App
* Advanced Analytics
* Multi-Branch Support

---

# 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first.

---

# 📄 License

This project is licensed under the MIT License.

---

# 👨‍💻 Author

Developed by **Your Name**

---

# ⭐ Support

If you like this project, please ⭐ the repository!
