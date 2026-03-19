// backend/routes/followupRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const {
  getAllFollowUps,
  getFollowUpNotes,
  createFollowUpNote,
  updateFollowUpNote,
  deleteFollowUpNote,
  getTodayReminders,
  getUpcomingReminders,
  getOverdueReminders,
  markReminderSent,
  getFollowUpStats,
  getFollowUpsByCounselor
} = require('../controllers/followupController');

// Apply auth middleware to all routes
router.use(verifyToken);

// GET routes
router.get('/', getAllFollowUps);                          // Get all follow-ups with filters
router.get('/stats', getFollowUpStats);                    // Get follow-up statistics
router.get('/reminders/today', getTodayReminders);         // Get today's reminders
router.get('/reminders/upcoming', getUpcomingReminders);   // Get upcoming reminders (next 7 days)
router.get('/reminders/overdue', getOverdueReminders);     // Get overdue reminders
router.get('/student/:studentId', getFollowUpNotes);       // Get follow-ups for a specific student
router.get('/counselor/:counselorName', getFollowUpsByCounselor); // Get follow-ups by counselor

// POST routes
router.post('/', createFollowUpNote);                       // Create a new follow-up

// PUT routes
router.put('/:id', updateFollowUpNote);                     // Update a follow-up
router.put('/:id/mark-sent', markReminderSent);             // Mark reminder as sent

// DELETE routes
router.delete('/:id', deleteFollowUpNote);                  // Delete a follow-up

module.exports = router;