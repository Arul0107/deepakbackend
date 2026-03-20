// backend/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken, adminOnly, canManageUsers, canViewUsers } = require('../middleware/authMiddleware');

// Public routes
router.post('/login', authController.login);

// Protected routes (all require authentication)
router.use(verifyToken);

// Profile routes
router.get('/profile', authController.getProfile);
router.put('/profile', authController.updateProfile);
router.put('/change-password', authController.changePassword);

// User management routes (admin only for create/delete)
router.post('/create-user', canManageUsers, authController.createUser);
router.delete('/users/:id', canManageUsers, authController.deleteUser);

// User viewing routes (all authenticated users can view)
router.get('/users', canViewUsers, authController.getUsers);
router.put('/users/:id', authController.updateUser); // Uses custom logic inside controller

module.exports = router;