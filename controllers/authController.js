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
   - Admin only
========================= */

exports.createUser = async (req, res) => {
  try {
    // Check if the current user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can create users'
      });
    }

    const { name, email, password, role, status = 'active' } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and password are required'
      });
    }

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

    // Validate role (prevent creating super_admin unless you're super_admin)
    if (role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can create super admin users'
      });
    }

    await db.query(
      "INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)",
      [name, email, password, role, status]
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
   - Authenticated users can view
========================= */

exports.getUsers = async (req, res) => {
  try {
    // Allow all authenticated users to view users
    const [users] = await db.query(
      "SELECT id, name, email, role, status, created_at as createdAt FROM users ORDER BY id DESC"
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
   - Admin can update any user
   - Users can update themselves (except role)
========================= */

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, status } = req.body;
    const currentUserId = req.user.id;
    const currentUserRole = req.user.role;

    // Check permissions
    const [targetUser] = await db.query(
      "SELECT role FROM users WHERE id = ?",
      [id]
    );

    if (targetUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Allow if: user is updating themselves OR user is admin
    const isSelf = parseInt(currentUserId) === parseInt(id);
    const isAdmin = currentUserRole === 'admin' || currentUserRole === 'super_admin';

    if (!isSelf && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own profile'
      });
    }

    // If not admin, prevent role/status changes
    if (!isAdmin) {
      // Users can only update name and email of themselves
      await db.query(
        "UPDATE users SET name=?, email=? WHERE id=?",
        [name, email, id]
      );
    } else {
      // Admin can update everything
      await db.query(
        "UPDATE users SET name=?, email=?, role=?, status=? WHERE id=?",
        [name, email, role, status, id]
      );
    }

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
   - Admin only (cannot delete themselves)
========================= */

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;
    const currentUserRole = req.user.role;

    // Check if user is admin
    if (currentUserRole !== 'admin' && currentUserRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can delete users'
      });
    }

    // Prevent deleting yourself
    if (parseInt(currentUserId) === parseInt(id)) {
      return res.status(403).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    // Check if user exists
    const [user] = await db.query(
      "SELECT id, role FROM users WHERE id = ?",
      [id]
    );

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Prevent deleting other admins if you're not super_admin
    if (user[0].role === 'admin' && currentUserRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can delete other admins'
      });
    }

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
      "SELECT id, name, email, role, status FROM users WHERE id = ?",
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

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