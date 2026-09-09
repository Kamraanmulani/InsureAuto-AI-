const sendSuccess = (res, statusCode = 200, payload = {}, message = null) => {
  const responseBody = {
    success: true,
    ...payload
  };
  if (message) {
    responseBody.message = message;
  }
  return res.status(statusCode).json(responseBody);
};

const sendError = (res, statusCode = 500, error = 'Internal Server Error', details = null) => {
  const responseBody = {
    success: false,
    error
  };
  if (details) {
    responseBody.details = details;
  }
  return res.status(statusCode).json(responseBody);
};

module.exports = {
  sendSuccess,
  sendError
};
