// backend/routes/studentRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken, adminOnly, counselorOnly } = require('../middleware/authMiddleware');
const {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  bulkCreateStudents,
  bulkAssignStudents,
  getStudentsByStatus,
  getStudentsByQuota,
  searchStudents,
  getStudentStats,
  getTodayFollowUps,
  exportStudents
} = require('../controllers/studentController');

// Apply auth middleware to all routes
router.use(verifyToken);

// ==================== PUBLIC ROUTES (authenticated users) ====================

// GET routes - accessible by all authenticated users (with role-based filtering in controller)
router.get('/', getStudents);
router.get('/stats', getStudentStats);
router.get('/search', searchStudents);
router.get('/today-followups', getTodayFollowUps);
router.get('/export', exportStudents);
router.get('/status/:status', getStudentsByStatus);
router.get('/quota/:quota', getStudentsByQuota);
router.get('/:id', getStudentById);

// PUT routes - accessible by all authenticated users (with role-based checks in controller)
router.put('/:id', updateStudent);

// ==================== ADMIN ONLY ROUTES ====================

// POST routes - admin only
router.post('/', adminOnly, createStudent);
router.post('/bulk', adminOnly, bulkCreateStudents);
router.post('/bulk-assign', adminOnly, bulkAssignStudents);

// DELETE routes - admin only
router.delete('/:id', adminOnly, deleteStudent);

module.exports = router;