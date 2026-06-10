const db = require("../../config/db");
const HashUtil = require("../../utils/hash");
const JWTUtil = require("../../utils/jwt");
const DatabaseManager = require("../../services/database-manager.service");
const logger = require("../../config/logger");
const bcrypt = require("bcryptjs");
const EmailService = require("../../config/email");
const crypto = require("crypto");

class AuthService {
  async login(email, password, ipAddress, tenantSubdomain = null) {
    try {
      // Superadmin login (no subdomain)
      if (!tenantSubdomain) {
        console.log("\n🔐 Superadmin login attempt:", email);

        const users = await db.query(
          'SELECT * FROM superadmins WHERE email = ? AND status = "active"',
          [email],
        );

        if (users.length === 0) {
          console.log("❌ Superadmin not found:", email);
          throw new Error("Invalid credentials");
        }

        const user = users[0];
        console.log("✓ Superadmin found:", user.name);

        const isValid = await HashUtil.comparePassword(password, user.password);
        console.log("  Password valid:", isValid);

        if (!isValid) {
          console.log("❌ Invalid password for superadmin");
          throw new Error("Invalid credentials");
        }

        // Update last login
        await db.query(
          "UPDATE superadmins SET last_login = NOW() WHERE id = ?",
          [user.id],
        );

        const token = JWTUtil.generateToken({
          id: user.id,
          email: user.email,
          role: "superadmin",
        });

        console.log("✅ Superadmin login successful\n");

        return {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: "superadmin",
            mobile: user.mobile,
          },
          token,
        };
      }

      // Tenant login
      console.log(
        "\n🔐 Tenant login attempt:",
        email,
        "subdomain:",
        tenantSubdomain,
      );

      // Get tenant with all fields including database connection info
      const tenant = await db.query(
        `SELECT id, name, subdomain, database_name, database_host, database_port, 
            database_user, database_password, status 
     FROM tenants 
     WHERE subdomain = ? AND status = 'active'`,
        [tenantSubdomain],
      );

      if (tenant.length === 0) {
        console.log("❌ Tenant not found:", tenantSubdomain);
        throw new Error("Tenant not found");
      }

      const tenantInfo = tenant[0];
      console.log("✓ Tenant found:", tenantInfo.name);
      console.log("  ID:", tenantInfo.id);
      console.log("  Database:", tenantInfo.database_name);
      console.log("  Host:", tenantInfo.database_host);
      console.log("  Port:", tenantInfo.database_port);

      // Get tenant database connection
      const tenantDb = await DatabaseManager.getTenantDatabaseConnection(
        tenantInfo.id,
      );

      try {
        console.log("  Querying users table...");

        // Execute query and handle the result format
        const queryResult = await tenantDb.query(
          'SELECT * FROM users WHERE email = ? AND status = "active"',
          [email],
        );

        // Log the result structure for debugging
        console.log(
          "Query result type:",
          Array.isArray(queryResult) ? "Array" : typeof queryResult,
        );
        console.log("Query result length:", queryResult?.length);

        // Handle the result format - mysql2 returns [rows, fields]
        let users;
        if (Array.isArray(queryResult) && queryResult.length >= 1) {
          // Check if the first element is an array (rows)
          if (Array.isArray(queryResult[0])) {
            users = queryResult[0];
            console.log("Format: [rows, fields] - using rows[0]");
          } else {
            users = queryResult;
            console.log("Format: rows only");
          }
        } else {
          users = queryResult;
        }

        console.log("Users found:", users?.length || 0);

        if (!users || users.length === 0) {
          console.log("❌ User not found in tenant database:", email);
          throw new Error("Invalid credentials");
        }

        const user = users[0];
        console.log("✓ User found:", user?.name || "Unknown");
        console.log("  Role:", user?.role);
        console.log("  Password hash exists:", !!user?.password);

        if (!user?.password) {
          console.log("❌ Password hash is missing!");
          throw new Error("Invalid credentials");
        }

        // Verify password using bcrypt
        console.log("  Verifying password...");
        const isValid = await bcrypt.compare(password, user.password);
        console.log("  Password valid:", isValid);

        if (!isValid) {
          console.log("❌ Invalid password for user:", email);
          throw new Error("Invalid credentials");
        }

        // Update last login
        await tenantDb.query(
          "UPDATE users SET last_login = NOW(), last_login_ip = ? WHERE id = ?",
          [ipAddress, user.id],
        );

        // Log login
        await tenantDb.query(
          `INSERT INTO login_logs (user_id, email, ip_address, login_status) 
         VALUES (?, ?, ?, 'success')`,
          [user.id, email, ipAddress],
        );

        const token = JWTUtil.generateToken({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenant_id: tenantInfo.id,
          tenant_subdomain: tenantSubdomain,
        });

        console.log("✅ Tenant login successful\n");

        return {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            mobile: user.mobile,
            tenant_id: tenantInfo.id,
            tenant_name: tenantInfo.name,
            tenant_subdomain: tenantInfo.subdomain,
          },
          token,
          tenant: {
            id: tenantInfo.id,
            name: tenantInfo.name,
            status: tenantInfo.status,
          },
        };
      } finally {
        await tenantDb.end();
      }
    } catch (error) {
      console.error("❌ Login service error:", error.message);
      logger.error("Login service error:", error);
      throw error;
    }
  }

  async changePassword(
    userId,
    currentPassword,
    newPassword,
    isSuperadmin = false,
    tenantId = null,
  ) {
    try {
      console.log("=== CHANGE PASSWORD SERVICE ===");
      console.log("UserId:", userId);
      console.log("TenantId:", tenantId);
      console.log("IsSuperadmin:", isSuperadmin);
      console.log("CurrentPassword provided:", !!currentPassword);
      console.log("NewPassword provided:", !!newPassword);

      if (!userId) {
        throw new Error("User ID is required");
      }

      const parsedUserId = parseInt(userId);
      if (isNaN(parsedUserId)) {
        throw new Error("Invalid user ID");
      }

      if (isSuperadmin) {
        // Superadmin - main database
        const users = await db.query(
          "SELECT id, password FROM superadmins WHERE id = ?",
          [parsedUserId],
        );

        if (users.length === 0) {
          throw new Error("User not found");
        }

        const user = users[0];

        if (!user.password) {
          throw new Error("Password not set for this user");
        }

        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) {
          throw new Error("Current password is incorrect");
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query("UPDATE superadmins SET password = ? WHERE id = ?", [
          hashedPassword,
          parsedUserId,
        ]);

        return true;
      } else {
        // Tenant Admin - tenant database
        if (!tenantId) {
          throw new Error("Tenant ID is required");
        }

        const tenantDb =
          await DatabaseManager.getTenantDatabaseConnection(tenantId);

        try {
          // Query user - mysql2 returns [rows, fields]
          const result = await tenantDb.query(
            "SELECT id, password FROM users WHERE id = ?",
            [parsedUserId],
          );

          // Extract rows from result (mysql2 format)
          const users = result[0];

          console.log("Query result length:", users?.length);

          if (!users || users.length === 0) {
            throw new Error("User not found");
          }

          const user = users[0];
          console.log("User found, password exists:", !!user?.password);

          if (!user.password) {
            throw new Error("Password not set for this user");
          }

          // Verify current password
          const isValid = await bcrypt.compare(currentPassword, user.password);
          console.log("Password valid:", isValid);

          if (!isValid) {
            throw new Error("Current password is incorrect");
          }

          // Hash new password
          const hashedPassword = await bcrypt.hash(newPassword, 10);

          // Update password
          await tenantDb.query("UPDATE users SET password = ? WHERE id = ?", [
            hashedPassword,
            parsedUserId,
          ]);

          console.log("Password changed successfully");
          return true;
        } finally {
          await tenantDb.end();
        }
      }
    } catch (error) {
      logger.error("Change password error:", error);
      throw error;
    }
  }

  async getProfile(userId, tenantId, isSuperadmin = false) {
    try {
      console.log("=== GET PROFILE SERVICE ===");
      console.log("UserId:", userId);
      console.log("TenantId:", tenantId);
      console.log("IsSuperadmin:", isSuperadmin);

      if (!userId) {
        throw new Error("User ID is required");
      }

      const parsedUserId = parseInt(userId);
      if (isNaN(parsedUserId)) {
        throw new Error("Invalid user ID");
      }

      if (isSuperadmin) {
        // Superadmin profile from main database
        const users = await db.query(
          "SELECT id, name, email, mobile, role, status, profile_image, last_login, created_at FROM superadmins WHERE id = ?",
          [parsedUserId],
        );

        if (users.length === 0) {
          throw new Error("User not found");
        }

        return users[0];
      } else {
        // Tenant admin profile from tenant database
        if (!tenantId) {
          throw new Error("Tenant ID is required");
        }

        const tenantDb =
          await DatabaseManager.getTenantDatabaseConnection(tenantId);

        try {
          const result = await tenantDb.query(
            "SELECT id, name, email, mobile, role, status, profile_image, last_login, created_at FROM users WHERE id = ?",
            [parsedUserId],
          );

          // Extract rows from mysql2 result
          const users = result[0];

          if (!users || users.length === 0) {
            throw new Error("User not found");
          }

          console.log("Profile data retrieved:", {
            name: users[0].name,
            email: users[0].email,
            mobile: users[0].mobile,
            role: users[0].role,
          });

          return users[0];
        } finally {
          await tenantDb.end();
        }
      }
    } catch (error) {
      logger.error("Get profile error:", error);
      throw error;
    }
  }

  async updateProfile(
    userId,
    tenantId,
    profileData,
    isSuperadmin = false,
    profileImage = null,
  ) {
    try {
      console.log("=== UPDATE PROFILE SERVICE ===");
      console.log("UserId:", userId);
      console.log("TenantId:", tenantId);
      console.log("IsSuperadmin:", isSuperadmin);
      console.log("Profile data:", profileData);
      console.log("Profile image provided:", !!profileImage);

      const parsedUserId = parseInt(userId);
      if (isNaN(parsedUserId)) {
        throw new Error("Invalid user ID");
      }

      const updates = [];
      const params = [];

      // Basic profile fields
      if (
        profileData.name !== undefined &&
        profileData.name !== null &&
        profileData.name !== ""
      ) {
        updates.push("name = ?");
        params.push(profileData.name);
      }

      if (
        profileData.mobile !== undefined &&
        profileData.mobile !== null &&
        profileData.mobile !== ""
      ) {
        updates.push("mobile = ?");
        params.push(profileData.mobile);
      }

      if (
        profileData.email !== undefined &&
        profileData.email !== null &&
        profileData.email !== ""
      ) {
        updates.push("email = ?");
        params.push(profileData.email);
      }

      // Handle profile image upload
      if (profileImage) {
        updates.push("profile_image = ?");
        params.push(profileImage);
      }

      if (updates.length === 0) {
        throw new Error("No fields to update");
      }

      updates.push("updated_at = NOW()");
      params.push(parsedUserId);

      let success = false;

      if (isSuperadmin) {
        // Update superadmin
        const mainDb = await DatabaseManager.getConnection();
        try {
          const result = await mainDb.query(
            `UPDATE superadmins SET ${updates.join(", ")} WHERE id = ?`,
            params,
          );
          success = result.affectedRows > 0;
        } finally {
          await mainDb.end();
        }
      } else {
        // Update tenant user
        if (!tenantId) {
          throw new Error("Tenant ID is required");
        }

        const tenantDb =
          await DatabaseManager.getTenantDatabaseConnection(tenantId);

        try {
          const result = await tenantDb.query(
            `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
            params,
          );
          success = result.affectedRows > 0;
          console.log("Update result:", result);
        } finally {
          await tenantDb.end();
        }
      }

      if (!success) {
        throw new Error("Failed to update profile");
      }

      // Fetch and return updated profile
      const updatedProfile = await this.getProfile(
        userId,
        tenantId,
        isSuperadmin,
      );

      return {
        success: true,
        message: "Profile updated successfully",
        data: updatedProfile,
      };
    } catch (error) {
      logger.error("Update profile error:", error);
      throw error;
    }
  }

  // Generate OTP
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Request Password Reset (Send OTP)
  // async requestPasswordReset(email, tenantSubdomain = null) {
  //   try {
  //     let user = null;
  //     let tenantId = null;
  //     let isSuperadmin = false;

  //     // Check if superadmin
  //     if (!tenantSubdomain) {
  //       const users = await db.query(
  //         'SELECT id, name, email FROM superadmins WHERE email = ? AND status = "active"',
  //         [email],
  //       );

  //       if (users.length > 0) {
  //         user = users[0];
  //         isSuperadmin = true;
  //       }
  //     } else {
  //       // Check in tenant database
  //       const tenant = await db.query(
  //         'SELECT id FROM tenants WHERE subdomain = ? AND status = "active"',
  //         [tenantSubdomain],
  //       );

  //       if (tenant.length === 0) {
  //         throw new Error("Tenant not found");
  //       }

  //       tenantId = tenant[0].id;
  //       const tenantDb =
  //         await DatabaseManager.getTenantDatabaseConnection(tenantId);

  //       try {
  //         const result = await tenantDb.query(
  //           'SELECT id, name, email FROM users WHERE email = ? AND status = "active"',
  //           [email],
  //         );

  //         const users = result[0];
  //         if (users && users.length > 0) {
  //           user = users[0];
  //         }
  //       } finally {
  //         await tenantDb.end();
  //       }
  //     }

  //     if (!user) {
  //       // Don't reveal that email doesn't exist for security
  //       return {
  //         success: true,
  //         message: "If the email exists, an OTP has been sent",
  //       };
  //     }

  //     // Generate OTP and expiry
  //     const otp = this.generateOTP();
  //     const otpExpiry = new Date();
  //     otpExpiry.setMinutes(otpExpiry.getMinutes() + 10); // 10 minutes expiry

  //     // Store OTP in database (create password_resets table)
  //     await db.query(
  //       `INSERT INTO password_resets (email, otp, expires_at, is_superadmin, tenant_id)
  //        VALUES (?, ?, ?, ?, ?)
  //        ON DUPLICATE KEY UPDATE otp = ?, expires_at = ?, created_at = NOW()`,
  //       [email, otp, otpExpiry, isSuperadmin, tenantId, otp, otpExpiry],
  //     );

  //     // Send OTP via email
  //     await EmailService.sendOTP(email, otp, user.name);

  //     return {
  //       success: true,
  //       message: "OTP sent to your email",
  //       email: email,
  //     };
  //   } catch (error) {
  //     logger.error("Request password reset error:", error);
  //     throw error;
  //   }
  // }

  // Request Password Reset (Send OTP) - WITH COMPLETE DEBUGGING
  async requestPasswordReset(email, tenantSubdomain = null) {
    try {
      console.log("\n🔐 ===== PASSWORD RESET REQUEST =====");
      console.log("📧 Email:", email);
      console.log(
        "🏢 Tenant Subdomain:",
        tenantSubdomain || "None (Superadmin)",
      );
      console.log("⏰ Time:", new Date().toISOString());

      let user = null;
      let tenantId = null;
      let isSuperadmin = false;

      // Check if superadmin
      if (!tenantSubdomain) {
        console.log("\n📌 Checking SUPERADMIN table...");
        const users = await db.query(
          'SELECT id, name, email FROM superadmins WHERE email = ? AND status = "active"',
          [email],
        );

        console.log(`📊 Found ${users.length} superadmin(s)`);

        if (users.length > 0) {
          user = users[0];
          isSuperadmin = true;
          console.log("✅ SUPERADMIN found:", {
            id: user.id,
            name: user.name,
            email: user.email,
          });
        } else {
          console.log("❌ No superadmin found with email:", email);
        }
      } else {
        console.log("\n📌 Checking TENANT with subdomain:", tenantSubdomain);

        // Get tenant info
        const tenants = await db.query(
          'SELECT id, name, subdomain, database_name, status FROM tenants WHERE subdomain = ? AND status = "active"',
          [tenantSubdomain],
        );

        console.log(`📊 Found ${tenants.length} tenant(s)`);

        if (tenants.length === 0) {
          console.log(
            "❌ No active tenant found with subdomain:",
            tenantSubdomain,
          );

          // Also check inactive tenants for debugging
          const inactiveTenants = await db.query(
            "SELECT id, name, subdomain, status FROM tenants WHERE subdomain = ?",
            [tenantSubdomain],
          );

          if (inactiveTenants.length > 0) {
            console.log(
              `⚠️ Tenant exists but status is: ${inactiveTenants[0].status}`,
            );
          }

          return {
            success: true,
            message: "If the email exists, an OTP has been sent",
          };
        }

        const tenant = tenants[0];
        tenantId = tenant.id;
        console.log("✅ Tenant found:", {
          id: tenant.id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          database: tenant.database_name,
          status: tenant.status,
        });

        // Get tenant database connection
        console.log("🔌 Connecting to tenant database...");
        let tenantDb = null;

        try {
          tenantDb =
            await DatabaseManager.getTenantDatabaseConnection(tenantId);
          console.log("✅ Tenant database connected successfully");

          // Query users table
          console.log("🔍 Querying users table with email:", email);
          const result = await tenantDb.query(
            'SELECT id, name, email, status FROM users WHERE email = ? AND status = "active"',
            [email],
          );

          // Handle mysql2 result format
          const users = Array.isArray(result) && result[0] ? result[0] : result;
          console.log(
            `📊 Query result type: ${Array.isArray(result) ? "Array" : typeof result}`,
          );
          console.log(`📊 Users found: ${users?.length || 0}`);

          if (users && users.length > 0) {
            user = users[0];
            console.log("✅ USER found in tenant database:", {
              id: user.id,
              name: user.name,
              email: user.email,
              status: user.status,
            });
          } else {
            console.log("❌ No active user found with email:", email);

            // Check if user exists but not active
            const inactiveUserResult = await tenantDb.query(
              "SELECT id, name, email, status FROM users WHERE email = ?",
              [email],
            );
            const inactiveUsers =
              Array.isArray(inactiveUserResult) && inactiveUserResult[0]
                ? inactiveUserResult[0]
                : inactiveUserResult;

            if (inactiveUsers && inactiveUsers.length > 0) {
              console.log(
                `⚠️ User exists but status is: ${inactiveUsers[0].status}`,
              );
            }
          }
        } catch (dbError) {
          console.error("❌ Tenant database error:", dbError.message);
          console.error("Stack:", dbError.stack);
        } finally {
          if (tenantDb) {
            await tenantDb.end();
            console.log("🔌 Tenant database connection closed");
          }
        }
      }

      if (!user) {
        console.log("\n⚠️ No user found - returning security message");
        return {
          success: true,
          message: "If the email exists, an OTP has been sent",
        };
      }

      console.log("\n✅ User validated! Proceeding with OTP generation...");

      // Generate OTP and expiry
      const otp = this.generateOTP();
      const otpExpiry = new Date();
      otpExpiry.setMinutes(otpExpiry.getMinutes() + 10);

      console.log(`🔑 Generated OTP: ${otp}`);
      console.log(`⏰ OTP Expiry: ${otpExpiry.toISOString()}`);

      // Store OTP in database
      console.log("💾 Storing OTP in password_resets table...");
      await db.query(
        `INSERT INTO password_resets (email, otp, expires_at, is_superadmin, tenant_id)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
       otp = VALUES(otp), 
       expires_at = VALUES(expires_at), 
       created_at = NOW(),
       is_used = 0`,
        [email, otp, otpExpiry, isSuperadmin ? 1 : 0, tenantId],
      );
      console.log("✅ OTP stored successfully");

      // Send OTP via email
      console.log(`📧 Attempting to send OTP email to: ${email}`);
      try {
        await EmailService.sendOTP(email, otp, user.name);
        console.log("✅ Email sent successfully!");
      } catch (emailError) {
        console.error("❌ Email sending failed:", emailError.message);
        // For development, log OTP to console
        if (process.env.NODE_ENV === "development") {
          console.log("\n⚠️⚠️⚠️ DEVELOPMENT MODE - NO EMAIL SENT ⚠️⚠️⚠️");
          console.log(`📧 Email: ${email}`);
          console.log(`🔑 OTP CODE: ${otp}`);
          console.log(`👤 User: ${user.name}`);
          console.log("⚠️⚠️⚠️ PLEASE USE THIS OTP FOR TESTING ⚠️⚠️⚠️\n");
        }
      }

      console.log("\n✅ Password reset request completed successfully");
      return {
        success: true,
        message: "OTP sent to your email",
        email: email,
      };
    } catch (error) {
      console.error("\n❌ Request password reset error:", error);
      logger.error("Request password reset error:", error);
      throw error;
    }
  }

  // Verify OTP
  async verifyOTP(email, otp) {
    try {
      console.log("=== VERIFY OTP ===");
      console.log("Email:", email);
      console.log("OTP:", otp);

      if (!email || !otp) {
        throw new Error("Email and OTP are required");
      }

      // Get OTP from database
      const resetRequests = await db.query(
        `SELECT * FROM password_resets 
         WHERE email = ? AND otp = ? AND is_used = 0
         ORDER BY created_at DESC LIMIT 1`,
        [email, otp],
      );

      const resetRequest = resetRequests[0];
      console.log("Found OTP record:", resetRequest ? "Yes" : "No");

      if (!resetRequest) {
        throw new Error("Invalid OTP");
      }

      // Check if expired
      const now = new Date();
      const expiresAt = new Date(resetRequest.expires_at);

      if (expiresAt < now) {
        throw new Error(`OTP expired at ${resetRequest.expires_at}`);
      }

      // Mark OTP as used
      await db.query("UPDATE password_resets SET is_used = 1 WHERE id = ?", [
        resetRequest.id,
      ]);

      return {
        success: true,
        message: "OTP verified successfully",
        is_superadmin: resetRequest.is_superadmin === 1,
        tenant_id: resetRequest.tenant_id,
        email: email,
      };
    } catch (error) {
      logger.error("Verify OTP error:", error);
      throw error;
    }
  }

  // Reset Password with OTP
  async resetPasswordWithOTP(email, otp, newPassword, tenantSubdomain = null) {
    try {
      // Verify OTP first
      const verification = await this.verifyOTP(email, otp);

      if (!verification.success) {
        throw new Error("Invalid or expired OTP");
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      if (verification.is_superadmin) {
        // Update superadmin password
        await db.query("UPDATE superadmins SET password = ? WHERE email = ?", [
          hashedPassword,
          email,
        ]);
      } else {
        // Update tenant user password
        const tenantId = verification.tenant_id;

        if (!tenantId) {
          // Get tenant from subdomain
          const tenant = await db.query(
            "SELECT id FROM tenants WHERE subdomain = ?",
            [tenantSubdomain],
          );

          if (tenant.length === 0) {
            throw new Error("Tenant not found");
          }

          const tenantDb = await DatabaseManager.getTenantDatabaseConnection(
            tenant[0].id,
          );

          try {
            await tenantDb.query(
              "UPDATE users SET password = ? WHERE email = ?",
              [hashedPassword, email],
            );
          } finally {
            await tenantDb.end();
          }
        } else {
          const tenantDb =
            await DatabaseManager.getTenantDatabaseConnection(tenantId);

          try {
            await tenantDb.query(
              "UPDATE users SET password = ? WHERE email = ?",
              [hashedPassword, email],
            );
          } finally {
            await tenantDb.end();
          }
        }
      }

      // Get user name for email
      let userName = "";
      if (verification.is_superadmin) {
        const users = await db.query(
          "SELECT name FROM superadmins WHERE email = ?",
          [email],
        );
        userName = users[0]?.name || "User";
      } else {
        const tenantId = verification.tenant_id;
        if (tenantId) {
          const tenantDb =
            await DatabaseManager.getTenantDatabaseConnection(tenantId);
          try {
            const users = await tenantDb.query(
              "SELECT name FROM users WHERE email = ?",
              [email],
            );
            userName = users[0]?.name || "User";
          } finally {
            await tenantDb.end();
          }
        }
      }

      // Send confirmation email
      await EmailService.sendPasswordResetConfirmation(email, userName);

      return {
        success: true,
        message: "Password reset successfully",
      };
    } catch (error) {
      logger.error("Reset password error:", error);
      throw error;
    }
  }
}

module.exports = new AuthService();
