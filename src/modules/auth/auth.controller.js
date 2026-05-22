const AuthService = require("./auth.service");
const ResponseUtil = require("../../utils/response");
const logger = require("../../config/logger");
const jwt = require("jsonwebtoken");

class AuthController {
  async login(req, res) {
    try {
      const { email, password, subdomain } = req.body;
      const result = await AuthService.login(
        email,
        password,
        req.ip,
        subdomain,
      );
      return ResponseUtil.success(res, result, "Login successful");
    } catch (error) {
      logger.error("Login error:", error);
      return ResponseUtil.error(res, error.message, 401);
    }
  }

  async getProfile(req, res) {
    try {
      const { password, ...user } = req.user;
      return ResponseUtil.success(res, user, "Profile fetched successfully");
    } catch (error) {
      logger.error("Get profile error:", error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  async changePassword(req, res) {
    try {
      console.log("=== CHANGE PASSWORD CONTROLLER ===");

      // Get token from header
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return ResponseUtil.error(res, "No token provided", 401);
      }

      // Decode token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("Decoded token:", decoded);

      const userId = decoded.id;
      const tenantId = decoded.tenant_id;
      const isSuperadmin = decoded.role === "superadmin";

      if (!userId) {
        return ResponseUtil.error(res, "User ID not found in token", 401);
      }

      const { current_password, new_password, confirm_password } = req.body;
      console.log("Request body received");

      // Validation
      if (!current_password) {
        return ResponseUtil.error(res, "Current password is required", 400);
      }

      if (!new_password) {
        return ResponseUtil.error(res, "New password is required", 400);
      }

      if (new_password.length < 6) {
        return ResponseUtil.error(
          res,
          "Password must be at least 6 characters",
          400,
        );
      }

      if (new_password !== confirm_password) {
        return ResponseUtil.error(res, "Passwords do not match", 400);
      }

      if (current_password === new_password) {
        return ResponseUtil.error(
          res,
          "New password cannot be the same as old password",
          400,
        );
      }

      // Change password
      await AuthService.changePassword(
        userId,
        current_password,
        new_password,
        isSuperadmin,
        tenantId,
      );

      return ResponseUtil.success(res, null, "Password changed successfully");
    } catch (error) {
      logger.error("Change password error:", error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  // async updateProfile(req, res) {
  //   try {
  //     console.log("=== UPDATE PROFILE CONTROLLER ===");

  //     // Get user info from token (set by middleware)
  //     const userId = req.user?.id;
  //     const tenantId = req.user?.tenant_id;
  //     const isSuperadmin = req.user?.role === "superadmin";

  //     if (!userId) {
  //       return ResponseUtil.error(res, "User not authenticated", 401);
  //     }

  //     const { name, mobile } = req.body;

  //     console.log("User ID:", userId);
  //     console.log("Name:", name);
  //     console.log("Mobile:", mobile);
  //     console.log("Is Superadmin:", isSuperadmin);

  //     // Prepare update data
  //     const profileData = {};
  //     if (name !== undefined && name !== "") {
  //       profileData.name = name;
  //     }
  //     if (mobile !== undefined && mobile !== "") {
  //       profileData.mobile = mobile;
  //     }

  //     // Check if any data to update
  //     if (Object.keys(profileData).length === 0) {
  //       return ResponseUtil.error(res, "No fields to update", 400);
  //     }

  //     // Call service to update profile
  //     await AuthService.updateProfile(
  //       userId,
  //       tenantId,
  //       profileData,
  //       isSuperadmin,
  //     );

  //     // Get updated profile
  //     const updatedProfile = await AuthService.getProfile(
  //       userId,
  //       tenantId,
  //       isSuperadmin,
  //     );

  //     // Remove password if present
  //     const { password, ...profile } = updatedProfile;

  //     return ResponseUtil.success(res, profile, "Profile updated successfully");
  //   } catch (error) {
  //     logger.error("Update profile error:", error);
  //     return ResponseUtil.error(
  //       res,
  //       error.message || "Failed to update profile",
  //       500,
  //     );
  //   }
  // }

  // Update Profile
  // auth.controller.js - UPDATED VERSION
  // src/modules/auth/auth.controller.js
  async updateProfile(req, res) {
  try {
    console.log("=== UPDATE PROFILE CONTROLLER ===");
    console.log("Content-Type:", req.headers["content-type"]);
    console.log("Request body (text fields):", req.body);
    console.log("Uploaded file:", req.file ? req.file.filename : "No file");
    console.log("req.user:", req.user); // Debug: Check if middleware set this

    // Get user from token (set by middleware) OR decode from token directly
    let userId = req.user?.id;
    let tenantId = req.user?.tenant_id;
    let isSuperadmin = req.user?.role === "superadmin";

    // If req.user is not set (middleware didn't run or failed), decode from token
    if (!userId) {
      console.log("⚠️ req.user not found, decoding from token directly...");
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log("❌ No authorization header found");
        return ResponseUtil.error(res, "No token provided", 401);
      }
      
      const token = authHeader.split(' ')[1];
      console.log("Token extracted");
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("Token decoded:", { id: decoded.id, role: decoded.role, tenant_id: decoded.tenant_id });
        
        userId = decoded.id;
        tenantId = decoded.tenant_id;
        isSuperadmin = decoded.role === "superadmin";
        
        console.log("✅ User authenticated via direct token decode");
      } catch (err) {
        console.error("❌ Token verification failed:", err.message);
        return ResponseUtil.error(res, "Invalid or expired token", 401);
      }
    }

    if (!userId) {
      console.log("❌ No user ID found");
      return ResponseUtil.error(res, "User not authenticated", 401);
    }

    console.log("Final userId:", userId);
    console.log("Final tenantId:", tenantId);
    console.log("Is Superadmin:", isSuperadmin);

    // Get ALL fields from request body (FormData fields come in req.body)
    const { name, mobile, email } = req.body;

    // Prepare update data
    const profileData = {};

    if (name && name !== "") {
      profileData.name = name;
    }
    if (mobile && mobile !== "") {
      profileData.mobile = mobile;
    }
    if (email && email !== "") {
      profileData.email = email;
    }

    // Handle file upload
    if (req.file) {
      // Store the file path (relative path for security)
      const fileUrl = `/uploads/profiles/${req.file.filename}`;
      profileData.profile_image = fileUrl;
      console.log("Profile image uploaded:", fileUrl);
    }

    console.log("Profile data to update:", profileData);

    if (Object.keys(profileData).length === 0) {
      return ResponseUtil.error(res, "No fields to update", 400);
    }

    // Update profile
    await AuthService.updateProfile(
      userId,
      tenantId,
      profileData,
      isSuperadmin,
    );

    // Get updated profile
    const updatedProfile = await AuthService.getProfile(
      userId,
      tenantId,
      isSuperadmin,
    );

    const cleanProfile = {
      id: updatedProfile.id,
      name: updatedProfile.name,
      email: updatedProfile.email,
      role: updatedProfile.role,
      mobile: updatedProfile.mobile,
      profile_image: updatedProfile.profile_image,
      tenant_id: tenantId,
    };

    console.log("✅ Profile updated successfully");
    
    return ResponseUtil.success(
      res,
      cleanProfile,
      "Profile updated successfully",
    );
  } catch (error) {
    console.error("❌ Update profile error:", error);
    return ResponseUtil.error(
      res,
      error.message || "Failed to update profile",
      500,
    );
  }
}
  async logout(req, res) {
    try {
      // Log logout activity
      logger.info(`User ${req.user.id} logged out`);
      return ResponseUtil.success(res, null, "Logged out successfully");
    } catch (error) {
      logger.error("Logout error:", error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  // Request Password Reset (Send OTP)
  async forgotPassword(req, res) {
    try {
      const { email, subdomain } = req.body;

      if (!email) {
        return ResponseUtil.error(res, "Email is required", 400);
      }

      const result = await AuthService.requestPasswordReset(email, subdomain);

      return ResponseUtil.success(res, result, result.message);
    } catch (error) {
      logger.error("Forgot password error:", error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  // Verify OTP
  async verifyOTP(req, res) {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return ResponseUtil.error(res, "Email and OTP are required", 400);
      }

      const result = await AuthService.verifyOTP(email, otp);

      return ResponseUtil.success(res, result, result.message);
    } catch (error) {
      logger.error("Verify OTP error:", error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  // Reset Password with OTP
  async resetPassword(req, res) {
    try {
      const { email, otp, new_password, confirm_password, subdomain } =
        req.body;

      if (!email || !otp || !new_password) {
        return ResponseUtil.error(
          res,
          "Email, OTP, and new password are required",
          400,
        );
      }

      if (new_password.length < 6) {
        return ResponseUtil.error(
          res,
          "Password must be at least 6 characters",
          400,
        );
      }

      if (new_password !== confirm_password) {
        return ResponseUtil.error(res, "Passwords do not match", 400);
      }

      const result = await AuthService.resetPasswordWithOTP(
        email,
        otp,
        new_password,
        subdomain,
      );

      return ResponseUtil.success(res, null, result.message);
    } catch (error) {
      logger.error("Reset password error:", error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }
}

module.exports = new AuthController();
