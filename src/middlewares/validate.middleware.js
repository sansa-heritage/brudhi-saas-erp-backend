const { validationResult } = require('express-validator');
const ResponseUtil = require('../utils/response');

class ValidateMiddleware {
  static validate(validations) {
    return async (req, res, next) => {
      await Promise.all(validations.map(validation => validation.run(req)));

      const errors = validationResult(req);
      if (errors.isEmpty()) {
        return next();
      }

      const formattedErrors = errors.array().map(error => ({
        field: error.param,
        message: error.msg,
        value: error.value,
        location: error.location,
      }));

      return ResponseUtil.validationError(res, formattedErrors);
    };
  }
}

module.exports = ValidateMiddleware;