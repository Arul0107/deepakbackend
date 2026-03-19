// backend/routes/authRoutes.js
const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const {verifyToken} = require("../middleware/authMiddleware");
const {checkRole} = require("../middleware/roleMiddleware");

/* LOGIN */
router.post("/login", authController.login);

/* CREATE USER */
router.post(
  "/create-user",
  verifyToken,
  checkRole("super_admin", "admin"),
  authController.createUser
);

/* GET USERS - Modified to allow more roles */
router.get(
  "/users",
  verifyToken,
  (req, res, next) => {
    // Allow super_admin, admin, manager, and telecaller to view users
    const allowedRoles = ["super_admin", "admin", "manager", "telecaller", "counselor", "staff"];
    if (allowedRoles.includes(req.user.role)) {
      next();
    } else {
      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions."
      });
    }
  },
  authController.getUsers
);/* PROFILE ROUTES */
router.get("/profile", verifyToken, authController.getProfile);

router.put("/profile", verifyToken, authController.updateProfile);

router.put("/change-password", verifyToken, authController.changePassword);


/* UPDATE USER */
router.put(
  "/users/:id",
  verifyToken,
  checkRole("super_admin", "admin"),
  authController.updateUser
);

/* DELETE USER */
router.delete(
  "/users/:id",
  verifyToken,
  checkRole("super_admin"),
  authController.deleteUser
);

module.exports = router;  