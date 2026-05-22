const jwt = require('jsonwebtoken');
const config = require('../config/env');

class JWTUtil {
  static generateToken(payload) {
    return jwt.sign(payload, config.JWT.SECRET, {
      expiresIn: config.JWT.EXPIRE,
      issuer: 'gasflow-erp',
      audience: 'gasflow-users',
    });
  }

  static verifyToken(token) {
    try {
      return jwt.verify(token, config.JWT.SECRET, {
        issuer: 'gasflow-erp',
        audience: 'gasflow-users',
      });
    } catch (error) {
      return null;
    }
  }

  static decodeToken(token) {
    return jwt.decode(token);
  }

  static generateRefreshToken(payload) {
    return jwt.sign(payload, config.JWT.SECRET, {
      expiresIn: '30d',
      issuer: 'gasflow-erp',
      audience: 'gasflow-users',
    });
  }
}

module.exports = JWTUtil;