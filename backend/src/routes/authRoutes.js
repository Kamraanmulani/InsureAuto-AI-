const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  listUsers,
  updateUserRole,
  createAdminUser
} = require('../controllers/authController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const {
  validateRegister,
  validateLogin,
  validateUserRoleUpdate
} = require('../middleware/validateMiddleware');

router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.get('/me', verifyToken, getMe);
router.get('/users', verifyToken, requireRole('ADMIN'), listUsers);
router.post('/users/admin', verifyToken, requireRole('ADMIN'), validateRegister, createAdminUser);
router.patch('/users/:id', verifyToken, requireRole('ADMIN'), validateUserRoleUpdate, updateUserRole);

module.exports = router;
