// backend/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification
} = require('../controllers/notificationController');

// Apply auth middleware to all routes
router.use(verifyToken);

// GET routes
router.get('/', getNotifications);

// PUT routes
router.put('/:id/read', markAsRead);
router.put('/read-all', markAllAsRead);

// POST routes (internal use)
router.post('/create', createNotification);

// DELETE routes
router.delete('/:id', deleteNotification);

module.exports = router;