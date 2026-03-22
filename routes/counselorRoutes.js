// backend/routes/counselorRoutes.js
const express = require('express');
const router  = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const {
  getAllTargets,
  getTargetByCounselor,
  upsertTarget,
  createCallLog,
  getCallLogs,
} = require('../controllers/counselorController');

router.use(verifyToken);

// Targets
router.get ('/targets',              getAllTargets);          // GET  /counselor/targets
router.get ('/targets/:counselorId', getTargetByCounselor);  // GET  /counselor/targets/42
router.put ('/targets/:counselorId', upsertTarget);          // PUT  /counselor/targets/42

// Call logs
router.get ('/logs', getCallLogs);    // GET  /counselor/logs
router.post('/logs', createCallLog);  // POST /counselor/logs

module.exports = router;