const { CLAIM_STATUS } = require('../models/Claim');

const isEmail = (email) => {
  if (typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
};

const isValidStatus = (status) => {
  return typeof status === 'string' && Object.values(CLAIM_STATUS).includes(status);
};

const isValidRecommendation = (rec) => {
  return ['APPROVE', 'MANUAL_REVIEW', 'REJECT'].includes(rec);
};

const isValidRole = (role) => {
  return ['ADMIN', 'ASSESSOR'].includes(role);
};

const sanitizeText = (text) => {
  if (typeof text !== 'string') return '';
  return text.trim();
};

const parsePagination = (query = {}) => {
  const parsedLimit = parseInt(query.limit, 10);
  const parsedSkip = parseInt(query.skip, 10);

  const limit = (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100) ? parsedLimit : 50;
  const skip = (!isNaN(parsedSkip) && parsedSkip >= 0) ? parsedSkip : 0;

  return { limit, skip };
};

module.exports = {
  isEmail,
  isValidStatus,
  isValidRecommendation,
  isValidRole,
  sanitizeText,
  parsePagination
};
