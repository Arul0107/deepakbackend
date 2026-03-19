// backend/routes/collegeRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken, adminOnly } = require('../middleware/authMiddleware');
const {
  getColleges,
  getCollegeById,
  createCollege,
  updateCollege,
  deleteCollege
} = require('../controllers/collegeController');

// Apply auth middleware to all routes
router.use(verifyToken);

// GET routes - accessible by all authenticated users
router.get('/', getColleges);
router.get('/:id', getCollegeById);

// POST/PUT/DELETE routes - admin only
router.post('/', adminOnly, createCollege);
router.put('/:id', adminOnly, updateCollege);
router.delete('/:id', adminOnly, deleteCollege);

module.exports = router;