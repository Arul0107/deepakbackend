// backend/controllers/authController.js
const db = require("../config/db");
const jwt = require("jsonwebtoken");

/* =========================
   LOGIN
========================= */

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    const user = rows[0];

    // In production, use bcrypt.compare()
    if (user.password !== password) {
      return res.status(401).json({
        success: false,
        message: "Invalid password"
      });
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        name: user.name,
        email: user.email,
        role: user.role 
      },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1d" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

/* =========================
   CREATE USER
========================= */

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user exists
    const [existing] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: "User already exists"
      });
    }

    await db.query(
      "INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, 'active')",
      [name, email, password, role]
    );

    res.json({
      success: true,
      message: "User created successfully"
    });

  } catch (err) {
    console.error("Create user error:", err);
    res.status(500).json({
      success: false,
      message: "Error creating user"
    });
  }
};

/* =========================
   GET USERS
========================= */

exports.getUsers = async (req, res) => {
  try {
    const [users] = await db.query(
      "SELECT id, name, email, role, status FROM users ORDER BY id DESC"
    );

    res.json({
      success: true,
      users
    });

  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching users"
    });
  }
};

/* =========================
   UPDATE USER
========================= */

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, status } = req.body;

    await db.query(
      "UPDATE users SET name=?, email=?, role=?, status=? WHERE id=?",
      [name, email, role, status, id]
    );

    res.json({
      success: true,
      message: "User updated successfully"
    });

  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({
      success: false,
      message: "Error updating user"
    });
  }
};

/* =========================
   DELETE USER
========================= */

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    await db.query("DELETE FROM users WHERE id=?", [id]);

    res.json({
      success: true,
      message: "User deleted successfully"
    });

  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({
      success: false,
      message: "Error deleting user"
    });
  }
};
/* =========================
   GET PROFILE
========================= */
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.query(
      "SELECT id, name, email, role FROM users WHERE id = ?",
      [userId]
    );

    res.json({
      success: true,
      user: rows[0]
    });

  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching profile"
    });
  }
};

/* =========================
   UPDATE PROFILE
========================= */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email } = req.body;

    await db.query(
      "UPDATE users SET name=?, email=? WHERE id=?",
      [name, email, userId]
    );

    res.json({
      success: true,
      message: "Profile updated successfully"
    });

  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({
      success: false,
      message: "Error updating profile"
    });
  }
};

/* =========================
   CHANGE PASSWORD
========================= */
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    const [rows] = await db.query(
      "SELECT password FROM users WHERE id=?",
      [userId]
    );

    const user = rows[0];

    if (user.password !== oldPassword) {
      return res.status(400).json({
        success: false,
        message: "Old password incorrect"
      });
    }

    await db.query(
      "UPDATE users SET password=? WHERE id=?",
      [newPassword, userId]
    );

    res.json({
      success: true,
      message: "Password updated successfully"
    });

  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({
      success: false,
      message: "Error changing password"
    });
  }
};
