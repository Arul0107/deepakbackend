// backend/routes/studentRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken, adminOnly, managerOnly, counselorOnly, telecallerOnly } = require('../middleware/authMiddleware');
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
  exportStudents,
  getBulkImportTemplate
} = require('../controllers/studentController');

// ==================== MIDDLEWARE ====================
// Apply authentication to all routes
router.use(verifyToken);

// ==================== PUBLIC ROUTES (Authenticated Users) ====================
// These routes are accessible by all authenticated users with role-based filtering in controllers

// GET routes - All authenticated users can access (controllers handle role-based filtering)
router.get('/', getStudents);
router.get('/stats', getStudentStats);
router.get('/search', searchStudents);
router.get('/today-followups', getTodayFollowUps);
router.get('/export', exportStudents);
router.get('/bulk/template', getBulkImportTemplate);
router.get('/status/:status', getStudentsByStatus);
router.get('/quota/:quota', getStudentsByQuota);
router.get('/:id', getStudentById);

// PUT route - All authenticated users can update (controllers handle role-based checks)
router.put('/:id', updateStudent);

// ==================== ADMIN & MANAGER ROUTES ====================
// Routes that require admin or manager privileges

// Create single student - Admin, Manager, Telecaller, Counselor can create
router.post('/', (req, res, next) => {
  // Allow admin, manager, telecaller, counselor
  if (req.user.role === 'admin' || req.user.role === 'manager' || 
      req.user.role === 'telecaller' || req.user.role === 'counselor') {
    return createStudent(req, res);
  }
  return res.status(403).json({ 
    success: false, 
    message: 'Access denied. Only admins, managers, telecallers, and counselors can create students.' 
  });
});

// Bulk create students - Admin, Manager, Telecaller can bulk import
router.post('/bulk', (req, res, next) => {
  // Allow admin, manager, telecaller
  if (req.user.role === 'admin' || req.user.role === 'manager' || req.user.role === 'telecaller') {
    return bulkCreateStudents(req, res);
  }
  return res.status(403).json({ 
    success: false, 
    message: 'Access denied. Only admins, managers, and telecallers can bulk import students.' 
  });
});

// Bulk assign students - Admin and Manager only
router.post('/bulk-assign', (req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'manager') {
    return bulkAssignStudents(req, res);
  }
  return res.status(403).json({ 
    success: false, 
    message: 'Access denied. Only admins and managers can bulk assign students.' 
  });
});

// Delete student - Admin and Manager only
router.delete('/:id', (req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'manager') {
    return deleteStudent(req, res);
  }
  return res.status(403).json({ 
    success: false, 
    message: 'Access denied. Only admins and managers can delete students.' 
  });
});

module.exports = router;