const ApiError = require('../utils/apiError');
const { isEmail, isValidStatus, isValidRecommendation, isValidRole, sanitizeText } = require('../utils/validators');

const validateRegister = (req, res, next) => {
  const { email, password, name } = req.body;

  if (!email || !isEmail(email)) {
    return next(ApiError.badRequest('A valid email address is required'));
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return next(ApiError.badRequest('Password must be at least 6 characters'));
  }

  if (!name || typeof name !== 'string' || !name.trim()) {
    return next(ApiError.badRequest('Full name is required'));
  }

  delete req.body.role;
  delete req.body.isActive;
  delete req.body.userId;
  delete req.body._id;

  req.body.name = sanitizeText(name);
  req.body.email = email.trim().toLowerCase();

  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(ApiError.badRequest('Email and password are required'));
  }

  if (typeof email !== 'string' || typeof password !== 'string') {
    return next(ApiError.badRequest('Invalid credential format'));
  }

  req.body.email = email.trim().toLowerCase();
  next();
};

const validateUserRoleUpdate = (req, res, next) => {
  const { role, isActive } = req.body;

  if (role !== undefined && !isValidRole(role)) {
    return next(ApiError.badRequest('Invalid role specified. Allowed: ADMIN, ASSESSOR'));
  }

  if (isActive !== undefined && typeof isActive !== 'boolean') {
    return next(ApiError.badRequest('isActive must be a boolean value'));
  }

  delete req.body.userId;
  delete req.body._id;
  delete req.body.password;

  next();
};

const validateClaimAnalyze = (req, res, next) => {
  const { claim_date, claim_description } = req.body;

  if (!claim_date || typeof claim_date !== 'string' || !claim_date.trim()) {
    return next(ApiError.badRequest('Incident date and description are required'));
  }

  if (!claim_description || typeof claim_description !== 'string' || !claim_description.trim()) {
    return next(ApiError.badRequest('Incident date and description are required'));
  }

  delete req.body.status;
  delete req.body.decision;
  delete req.body.auditHistory;
  delete req.body.humanAssessment;
  delete req.body.assessorOverride;
  delete req.body._id;

  next();
};

const validateStatusUpdate = (req, res, next) => {
  const { status, assessorNotes } = req.body;

  if (!status || !isValidStatus(status)) {
    return next(ApiError.badRequest('Invalid status'));
  }

  delete req.body.assessorId;
  delete req.body.decisionMaker;
  delete req.body.actor;
  delete req.body._id;

  req.body.assessorNotes = sanitizeText(assessorNotes);

  next();
};

const validateDecisionOverride = (req, res, next) => {
  const { newRecommendation, reason } = req.body;

  if (!newRecommendation || !isValidRecommendation(newRecommendation)) {
    return next(ApiError.badRequest('Invalid recommendation'));
  }

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return next(ApiError.badRequest('Justification reason is required'));
  }

  delete req.body.assessorId;
  delete req.body.decisionMaker;
  delete req.body.actor;
  delete req.body._id;

  req.body.reason = sanitizeText(reason);

  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateUserRoleUpdate,
  validateClaimAnalyze,
  validateStatusUpdate,
  validateDecisionOverride
};
