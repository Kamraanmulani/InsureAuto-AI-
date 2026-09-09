const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const config = require('../config/env');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(ApiError.unauthorized('Authentication required. No token provided.'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return next(ApiError.unauthorized('User account is inactive or no longer exists.'));
    }

    req.user = {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role
    };
    next();
  } catch (error) {
    return next(ApiError.unauthorized('Invalid or expired token.'));
  }
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden('Forbidden. Insufficient permissions.'));
    }
    next();
  };
};

module.exports = { verifyToken, requireRole };
