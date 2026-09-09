const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/insurance_claims',
  jwtSecret: process.env.JWT_SECRET || 'claim-sight-default-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  mlApiUrl: process.env.ML_API_URL || 'http://localhost:8000',
  maxUploadSizeBytes: 50 * 1024 * 1024
};
