// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: "No token provided" 
    });
  }

  try {
    const decoded = jwt.verify(
      token.split(" ")[1],
      process.env.JWT_SECRET || "secret"
    );

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ 
      success: false,
      message: "Invalid token" 
    });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin only.'
    });
  }
  next();
};

const counselorOnly = (req, res, next) => {
  if (req.user.role !== 'counselor' && req.user.role !== 'staff' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Counselor/Staff only.'
    });
  }
  next();
};

module.exports = { verifyToken, adminOnly, counselorOnly };