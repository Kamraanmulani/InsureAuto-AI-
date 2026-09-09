const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const config = require('../config/env');

const generateToken = (user) => {
  return jwt.sign(
    { userId: user._id, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
};

const sanitizeUser = (user) => {
  return {
    id: user._id,
    email: user.email,
    name: user.name,
    role: user.role
  };
};

const register = async ({ email, password, name }) => {
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw ApiError.badRequest('User already exists');
  }

  const user = new User({
    email: email.toLowerCase(),
    password,
    name: name.trim(),
    role: 'ASSESSOR'
  });

  await user.save();
  const token = generateToken(user);

  return {
    token,
    user: sanitizeUser(user)
  };
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  const isValidPassword = await user.comparePassword(password);
  if (!isValidPassword) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  const token = generateToken(user);

  return {
    token,
    user: sanitizeUser(user)
  };
};

const getMe = async (userId) => {
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('User not found or inactive');
  }
  return sanitizeUser(user);
};

const listUsers = async () => {
  return await User.find({}).sort({ createdAt: -1 });
};

const updateUserRole = async (targetUserId, { role, isActive }) => {
  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    throw ApiError.notFound('User not found');
  }

  if (role) {
    targetUser.role = role;
  }

  if (typeof isActive === 'boolean') {
    targetUser.isActive = isActive;
  }

  await targetUser.save();
  return targetUser;
};

const createAdminUser = async ({ email, password, name }) => {
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw ApiError.badRequest('User already exists');
  }

  const user = new User({
    email: email.toLowerCase(),
    password,
    name: name.trim(),
    role: 'ADMIN'
  });

  await user.save();
  const token = generateToken(user);

  return {
    token,
    user: sanitizeUser(user)
  };
};

module.exports = {
  register,
  login,
  getMe,
  listUsers,
  updateUserRole,
  createAdminUser
};
