// backend/controllers/collegeController.js
const db = require('../config/db');
const { supabase, supabaseAdmin, bucketName, ensureBucketExists } = require('../config/supabase');
const path = require('path');
const fs = require('fs');

// Upload file to Supabase Storage
const uploadToSupabase = async (file, folder, collegeId = null) => {
  try {
    if (!file || !file.buffer) {
      throw new Error('No file buffer provided');
    }
    
    // Ensure bucket exists before upload
    await ensureBucketExists();
    
    const fileExt = file.originalname.split('.').pop();
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const fileName = `${timestamp}-${randomStr}.${fileExt}`;
    
    let filePath = `${folder}/${fileName}`;
    
    // If collegeId is provided, organize files by college
    if (collegeId) {
      filePath = `${folder}/${collegeId}/${fileName}`;
    }
    
    console.log(`\n📤 Uploading to Supabase:`);
    console.log(`   Bucket: ${bucketName}`);
    console.log(`   Path: ${filePath}`);
    console.log(`   Size: ${(file.buffer.length / 1024).toFixed(2)} KB`);
    console.log(`   Type: ${file.mimetype}`);
    
    // Upload file using admin client for better permissions
    const { data, error } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      console.error('Supabase upload error:', error);
      throw error;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);
    
    console.log(`✅ File uploaded successfully!`);
    console.log(`   URL: ${publicUrl}`);
    
    return {
      success: true,
      url: publicUrl,
      path: filePath,
      fileName: fileName
    };
  } catch (error) {
    console.error('❌ Upload error:', error);
    
    // Fallback to local storage if Supabase fails
    try {
      console.log('💾 Falling back to local storage...');
      const uploadDir = path.join(__dirname, '../uploads', folder);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const fileExt = file.originalname.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      let filePath = `${folder}/${fileName}`;
      
      if (collegeId) {
        filePath = `${folder}/${collegeId}/${fileName}`;
      }
      
      const fullPath = path.join(__dirname, '../uploads', filePath);
      fs.writeFileSync(fullPath, file.buffer);
      
      const localUrl = `/uploads/${filePath}`;
      
      console.log(`✅ File saved locally: ${localUrl}`);
      
      return {
        success: true,
        url: localUrl,
        path: filePath,
        fileName: fileName
      };
    } catch (localError) {
      console.error('Local storage fallback failed:', localError);
      throw error;
    }
  }
};

// Delete file from storage
const deleteFromStorage = async (filePath) => {
  try {
    if (!filePath) return true;
    
    console.log(`\n🗑️ Deleting from storage: ${filePath}`);
    
    // Try Supabase deletion using admin client
    const { error } = await supabaseAdmin.storage
      .from(bucketName)
      .remove([filePath]);
    
    if (error) {
      console.log('Supabase delete failed, trying local delete...');
      // Try local deletion
      const localPath = path.join(__dirname, '../uploads', filePath);
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
        console.log(`✅ Deleted local file: ${localPath}`);
      } else {
        console.log('File not found locally');
      }
    } else {
      console.log(`✅ Deleted from Supabase: ${filePath}`);
    }
    
    return true;
  } catch (error) {
    console.error('Delete error:', error);
    return false;
  }
};

// Get all colleges
const getColleges = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, code, location, affiliated_university, courses_offered, contact_number, email, website, status, banner_image_url, created_at FROM colleges ORDER BY name ASC'
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

// Create college
const createCollege = async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    
    const { name, code, location, affiliated_university, courses_offered, contact_number, email, website } = req.body;
    
    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: 'Name and code are required'
      });
    }
    
    let bannerImageUrl = null;
    let bannerPath = null;
    
    // Handle banner upload if file exists
    if (req.file && req.file.buffer) {
      try {
        console.log('\n📸 Uploading banner for new college...');
        const uploadResult = await uploadToSupabase(req.file, 'banners');
        bannerImageUrl = uploadResult.url;
        bannerPath = uploadResult.path;
      } catch (uploadError) {
        console.error('Banner upload failed:', uploadError);
        // Continue without banner
      }
    }
    
    const [result] = await connection.query(
      `INSERT INTO colleges (
        name, code, location, affiliated_university, 
        courses_offered, contact_number, email, website,
        banner_image_url, banner_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, code, location, affiliated_university, courses_offered, contact_number, email, website, bannerImageUrl, bannerPath]
    );
    
    const [newCollege] = await connection.query(
      'SELECT * FROM colleges WHERE id = ?',
      [result.insertId]
    );
    
    await connection.commit();
    
    res.status(201).json({
      success: true,
      message: 'College created successfully',
      data: newCollege[0]
    });
  } catch (error) {
    if (connection) await connection.rollback();
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
  } finally {
    if (connection) connection.release();
  }
};

// Update college
const updateCollege = async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    
    const { id } = req.params;
    const updateData = req.body;
    
    const [existing] = await connection.query(
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
      if (updateData[field] !== undefined && updateData[field] !== null && updateData[field] !== '') {
        fields.push(`${field} = ?`);
        values.push(updateData[field]);
      }
    });
    
    // Handle banner upload if new file is provided
    if (req.file && req.file.buffer) {
      try {
        // Delete old banner if exists
        if (existing[0].banner_path) {
          console.log('\n🗑️ Deleting old banner...');
          await deleteFromStorage(existing[0].banner_path);
        }
        
        console.log('\n📸 Uploading new banner...');
        const uploadResult = await uploadToSupabase(req.file, 'banners', id);
        fields.push(`banner_image_url = ?`);
        fields.push(`banner_path = ?`);
        values.push(uploadResult.url);
        values.push(uploadResult.path);
        console.log('✅ Banner updated successfully');
      } catch (uploadError) {
        console.error('Banner upload failed:', uploadError);
        // Continue with update even if banner upload fails
      }
    }
    
    fields.push('updated_at = NOW()');
    
    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }
    
    const query = `UPDATE colleges SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);
    
    await connection.query(query, values);
    
    const [updatedCollege] = await connection.query(
      'SELECT * FROM colleges WHERE id = ?',
      [id]
    );
    
    await connection.commit();
    
    res.status(200).json({
      success: true,
      message: 'College updated successfully',
      data: updatedCollege[0]
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('❌ Error updating college:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error updating college',
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
};

// Delete college (soft delete)
const deleteCollege = async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    
    const { id } = req.params;
    
    const [existing] = await connection.query(
      'SELECT * FROM colleges WHERE id = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'College not found'
      });
    }
    
    // Delete banner from storage if exists
    if (existing[0].banner_path) {
      console.log('\n🗑️ Deleting college banner...');
      await deleteFromStorage(existing[0].banner_path);
    }
    
    // Get and delete all documents from storage
    const [documents] = await connection.query(
      'SELECT document_path FROM college_documents WHERE college_id = ?',
      [id]
    );
    
    if (documents.length > 0) {
      console.log(`\n🗑️ Deleting ${documents.length} documents...`);
      for (const doc of documents) {
        if (doc.document_path) {
          await deleteFromStorage(doc.document_path);
        }
      }
    }
    
    // Delete documents from database
    await connection.query(
      'DELETE FROM college_documents WHERE college_id = ?',
      [id]
    );
    
    // Delete shares
    await connection.query(
      'DELETE FROM college_shares WHERE college_id = ?',
      [id]
    );
    
    // Soft delete - update status
    await connection.query(
      'UPDATE colleges SET status = "inactive", updated_at = NOW() WHERE id = ?',
      [id]
    );
    
    await connection.commit();
    
    res.status(200).json({
      success: true,
      message: 'College deleted successfully'
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('❌ Error deleting college:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting college',
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  getColleges,
  getCollegeById,
  createCollege,
  updateCollege,
  deleteCollege,
  uploadToSupabase,
  deleteFromStorage
};