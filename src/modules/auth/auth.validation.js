const { body } = require("express-validator");

class AuthValidation {
  static register() {
    return [
      body("name").notEmpty().withMessage("Name is required"),
      body("email").isEmail().withMessage("Valid email required"),
      body("password")
        .isLength({ min: 6 })
        .withMessage("Password must be at least 6 characters"),
      body("mobile")
        .matches(/^[0-9]{10}$/)
        .withMessage("Valid mobile required"),
    ];
  }

  static login() {
    return [
      body("email").isEmail().withMessage("Valid email required"),
      body("password").notEmpty().withMessage("Password required"),
    ];
  }

  static changePassword() {
    return [
      body("new_password")
        .isLength({ min: 6 })
        .withMessage("New password must be at least 6 characters"),
      body("confirm_password").custom((value, { req }) => {
        if (value !== req.body.new_password) {
          throw new Error("Passwords do not match");
        }
        return true;
      }),
    ];
  }

  // ========== UPDATE PROFILE VALIDATION ==========
  static updateProfile() {
    return [
      body("name")
        .optional()
        .isString()
        .withMessage("Name must be a string")
        .isLength({ min: 2, max: 100 })
        .withMessage("Name must be between 2 and 100 characters")
        .trim(),

      body("mobile")
        .optional()
        .matches(/^[0-9]{10}$/)
        .withMessage("Mobile number must be 10 digits")
        .trim(),

      body("email")
        .optional()
        .isEmail()
        .withMessage("Valid email required")
        .normalizeEmail(),

      body("address")
        .optional()
        .isString()
        .withMessage("Address must be a string")
        .isLength({ max: 500 })
        .withMessage("Address cannot exceed 500 characters")
        .trim(),

      body("city")
        .optional()
        .isString()
        .withMessage("City must be a string")
        .isLength({ max: 100 })
        .withMessage("City name too long")
        .trim(),

      body("state")
        .optional()
        .isString()
        .withMessage("State must be a string")
        .isLength({ max: 100 })
        .withMessage("State name too long")
        .trim(),

      body("country")
        .optional()
        .isString()
        .withMessage("Country must be a string")
        .isLength({ max: 100 })
        .withMessage("Country name too long")
        .trim(),

      body("zip_code")
        .optional()
        .matches(/^[0-9]{5,6}$/)
        .withMessage("Zip code must be 5 or 6 digits")
        .trim(),

      // Custom validation: At least one field should be provided
      body().custom((value, { req }) => {
        const allowedFields = [
          "name",
          "mobile",
          "email",
          "address",
          "city",
          "state",
          "country",
          "zip_code",
        ];
        const hasAtLeastOneField = allowedFields.some(
          (field) => req.body[field] !== undefined && req.body[field] !== "",
        );

        if (!hasAtLeastOneField) {
          throw new Error("At least one field is required to update");
        }
        return true;
      }),
    ];
  }
}

module.exports = AuthValidation;
