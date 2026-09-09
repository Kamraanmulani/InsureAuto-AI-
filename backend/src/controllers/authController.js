const authService = require('../services/authService');
const { sendSuccess } = require('../utils/apiResponse');

const register = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    const result = await authService.register({ email, password, name });
    return sendSuccess(res, 201, result, 'Registration successful');
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    return sendSuccess(res, 200, result, 'Login successful');
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.userId);
    return sendSuccess(res, 200, { user });
  } catch (error) {
    next(error);
  }
};

const listUsers = async (req, res, next) => {
  try {
    const users = await authService.listUsers();
    return sendSuccess(res, 200, { users });
  } catch (error) {
    next(error);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const { role, isActive } = req.body;
    const updatedUser = await authService.updateUserRole(req.params.id, { role, isActive });
    return sendSuccess(res, 200, { user: updatedUser }, 'User updated successfully');
  } catch (error) {
    next(error);
  }
};

const createAdminUser = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    const result = await authService.createAdminUser({ email, password, name });
    return sendSuccess(res, 201, result, 'Admin created successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
  listUsers,
  updateUserRole,
  createAdminUser
};
