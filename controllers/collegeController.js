// backend/controllers/collegeController.js
const db = require('../config/db');

// Get all colleges
const getColleges = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM colleges WHERE status = "active" ORDER BY name ASC'
    );
    
    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('❌ Error fetching colleges:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching colleges',
      error: error.message
    });
  }
};

// Get college by ID
const getCollegeById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await db.query(
      'SELECT * FROM colleges WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'College not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('❌ Error fetching college:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching college',
      error: error.message
    });
  }
};

// Create college (admin only)
const createCollege = async (req, res) => {
  try {
    const { name, code, location, affiliated_university, courses_offered, contact_number, email, website } = req.body;
    
    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: 'Name and code are required'
      });
    }
    
    const [result] = await db.query(
      `INSERT INTO colleges (
        name, code, location, affiliated_university, 
        courses_offered, contact_number, email, website
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, code, location, affiliated_university, courses_offered, contact_number, email, website]
    );
    
    const [newCollege] = await db.query(
      'SELECT * FROM colleges WHERE id = ?',
      [result.insertId]
    );
    
    res.status(201).json({
      success: true,
      message: 'College created successfully',
      data: newCollege[0]
    });
  } catch (error) {
    console.error('❌ Error creating college:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'College code already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating college',
      error: error.message
    });
  }
};

// Update college (admin only)
const updateCollege = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const [existing] = await db.query(
      'SELECT * FROM colleges WHERE id = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'College not found'
      });
    }
    
    const fields = [];
    const values = [];
    
    const allowedFields = ['name', 'code', 'location', 'affiliated_university', 'courses_offered', 'contact_number', 'email', 'website', 'status'];
    
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(updateData[field]);
      }
    });
    
    fields.push('updated_at = NOW()');
    
    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }
    
    const query = `UPDATE colleges SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);
    
    await db.query(query, values);
    
    const [updatedCollege] = await db.query(
      'SELECT * FROM colleges WHERE id = ?',
      [id]
    );
    
    res.status(200).json({
      success: true,
      message: 'College updated successfully',
      data: updatedCollege[0]
    });
  } catch (error) {
    console.error('❌ Error updating college:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating college',
      error: error.message
    });
  }
};

// Delete college (admin only)
const deleteCollege = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [existing] = await db.query(
      'SELECT * FROM colleges WHERE id = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'College not found'
      });
    }
    
    // Soft delete - update status instead of actual delete
    await db.query(
      'UPDATE colleges SET status = "inactive" WHERE id = ?',
      [id]
    );
    
    res.status(200).json({
      success: true,
      message: 'College deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting college:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting college',
      error: error.message
    });
  }
};

module.exports = {
  getColleges,
  getCollegeById,
  createCollege,
  updateCollege,
  deleteCollege
};