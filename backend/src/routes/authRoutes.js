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

router.post('/register', register);
router.post('/login', login);
router.get('/me', verifyToken, getMe);
router.get('/users', verifyToken, requireRole('ADMIN'), listUsers);
router.post('/users/admin', verifyToken, requireRole('ADMIN'), createAdminUser);
router.patch('/users/:id', verifyToken, requireRole('ADMIN'), updateUserRole);

module.exports = router;
