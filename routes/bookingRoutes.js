// routes/bookingRoutes.js
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const bookingController = require("../controllers/bookingController");
const upload = require("../middleware/upload");

// Create a dummy admin middleware
const bypassAdmin = (req, res, next) => {
  next();
};

// ================= USER ROUTES =================
// Handle multipart form data for booking creation
router.post(
  "/", 
  verifyToken, 
  upload.fields([
    { name: 'passportCopy', maxCount: 1 },
    { name: 'visaCopy', maxCount: 1 },
    { name: 'idCopy', maxCount: 1 },
    { name: 'insuranceDocument', maxCount: 1 }
  ]), 
  bookingController.createBooking
);

router.get("/my-bookings", verifyToken, bookingController.getMyBookings);
router.get("/:id", verifyToken, bookingController.getBookingById);

// ================= ADMIN ROUTES =================
router.get("/admin/all", verifyToken, bypassAdmin, bookingController.getAllBookings);
router.get("/admin/stats", verifyToken, bypassAdmin, bookingController.getBookingStats);
router.put("/admin/:id/status", verifyToken, bypassAdmin, bookingController.updateBookingStatus);

module.exports = router;