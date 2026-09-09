const ApiError = require('../utils/apiError');
const { sendError } = require('../utils/apiResponse');

const notFoundHandler = (req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof ApiError) {
    return sendError(res, err.statusCode, err.message, err.details);
  }

  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => e.message).join(', ');
    return sendError(res, 400, details || 'Validation error');
  }

  if (err.name === 'CastError') {
    return sendError(res, 400, `Invalid value provided for ${err.path}`);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'Field';
    return sendError(res, 409, `${field} already exists`);
  }

  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 401, 'Invalid authentication token');
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, 401, 'Authentication token has expired');
  }

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 400, 'File size exceeds permitted limit of 50MB');
    }
    return sendError(res, 400, err.message || 'File upload error');
  }

  if (err.message && err.message.includes('Invalid lifecycle state transition')) {
    return sendError(res, 400, err.message);
  }

  return sendError(res, 500, 'An internal error occurred. Please try again later.');
};

module.exports = {
  notFoundHandler,
  errorHandler
};
