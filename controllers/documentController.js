// backend/controllers/documentController.js
const db = require('../config/db');
const { supabase, supabaseAdmin, bucketName, ensureBucketExists } = require('../config/supabase');
const crypto = require('crypto');

// Upload document for college
const uploadDocument = async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    
    const { college_id, document_type, document_name, description, is_public } = req.body;
    
    if (!college_id || !req.file) {
      return res.status(400).json({
        success: false,
        message: 'College ID and document file are required'
      });
    }
    
    // Check if college exists
    const [college] = await connection.query(
      'SELECT id FROM colleges WHERE id = ?',
      [college_id]
    );
    
    if (college.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'College not found'
      });
    }
    
    // Ensure bucket exists
    await ensureBucketExists();
    
    // Upload to Supabase Storage
    const fileExt = req.file.originalname.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `documents/${college_id}/${fileName}`;
    
    console.log(`\n📄 Uploading document to Supabase:`);
    console.log(`   Path: ${filePath}`);
    console.log(`   Size: ${(req.file.buffer.length / 1024).toFixed(2)} KB`);
    
    const { data, error } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        cacheControl: '3600'
      });
    
    if (error) {
      console.error('Supabase upload error:', error);
      throw error;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);
    
    const fileSize = req.file.size;
    const mimeType = req.file.mimetype;
    const docName = document_name || req.file.originalname;
    
    const [result] = await connection.query(
      `INSERT INTO college_documents (
        college_id, document_type, document_name, document_path, 
        document_url, file_size, mime_type, description, is_public
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [college_id, document_type || 'pdf', docName, filePath, publicUrl, fileSize, mimeType, description || null, is_public !== undefined ? is_public : true]
    );
    
    const [newDocument] = await connection.query(
      'SELECT * FROM college_documents WHERE id = ?',
      [result.insertId]
    );
    
    await connection.commit();
    
    console.log(`✅ Document uploaded: ${publicUrl}`);
    
    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: newDocument[0]
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('❌ Error uploading document:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error uploading document',
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
};

// Get all documents for a college
const getCollegeDocuments = async (req, res) => {
  try {
    const { college_id } = req.params;
    
    const [documents] = await db.query(
      'SELECT * FROM college_documents WHERE college_id = ? ORDER BY upload_date DESC',
      [college_id]
    );
    
    res.status(200).json({
      success: true,
      count: documents.length,
      data: documents
    });
  } catch (error) {
    console.error('❌ Error fetching documents:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching documents',
      error: error.message
    });
  }
};

// Get document by ID
const getDocumentById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [documents] = await db.query(
      'SELECT * FROM college_documents WHERE id = ?',
      [id]
    );
    
    if (documents.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: documents[0]
    });
  } catch (error) {
    console.error('❌ Error fetching document:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching document',
      error: error.message
    });
  }
};

// Delete document
const deleteDocument = async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    
    const { id } = req.params;
    
    const [document] = await connection.query(
      'SELECT * FROM college_documents WHERE id = ?',
      [id]
    );
    
    if (document.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    // Delete file from Supabase Storage
    if (document[0].document_path) {
      console.log(`\n🗑️ Deleting document: ${document[0].document_path}`);
      const { error } = await supabaseAdmin.storage
        .from(bucketName)
        .remove([document[0].document_path]);
      
      if (error) {
        console.error('Error deleting from Supabase:', error);
      } else {
        console.log('✅ Document deleted from storage');
      }
    }
    
    // Delete shares associated with this document
    await connection.query(
      'DELETE FROM college_shares WHERE document_id = ?',
      [id]
    );
    
    // Delete from database
    await connection.query(
      'DELETE FROM college_documents WHERE id = ?',
      [id]
    );
    
    await connection.commit();
    
    res.status(200).json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('❌ Error deleting document:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting document',
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
};

// Generate share token for document or college
const generateShareToken = async (req, res) => {
  try {
    const { college_id, document_id, share_type, expires_in_hours } = req.body;
    
    if (!college_id || !share_type) {
      return res.status(400).json({
        success: false,
        message: 'College ID and share type are required'
      });
    }
    
    // Check if college exists
    const [college] = await db.query(
      'SELECT id, name FROM colleges WHERE id = ?',
      [college_id]
    );
    
    if (college.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'College not found'
      });
    }
    
    // If document share, check if document exists
    if (share_type === 'document' && document_id) {
      const [document] = await db.query(
        'SELECT * FROM college_documents WHERE id = ? AND college_id = ?',
        [document_id, college_id]
      );
      
      if (document.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Document not found'
        });
      }
    }
    
    // Generate unique share token
    const shareToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = expires_in_hours ? new Date(Date.now() + expires_in_hours * 60 * 60 * 1000) : null;
    const shareUrl = `${req.protocol}://${req.get('host')}/api/share/${shareToken}`;
    
    const [result] = await db.query(
      `INSERT INTO college_shares (college_id, document_id, share_type, share_token, share_url, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [college_id, document_id || null, share_type, shareToken, shareUrl, expiresAt]
    );
    
    res.status(201).json({
      success: true,
      message: 'Share link generated successfully',
      data: {
        share_token: shareToken,
        share_url: shareUrl,
        expires_at: expiresAt
      }
    });
  } catch (error) {
    console.error('❌ Error generating share token:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating share link',
      error: error.message
    });
  }
};

// Access shared content
const accessSharedContent = async (req, res) => {
  try {
    const { token } = req.params;
    
    const [share] = await db.query(
      'SELECT * FROM college_shares WHERE share_token = ?',
      [token]
    );
    
    if (share.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Share link not found'
      });
    }
    
    const shareData = share[0];
    
    // Check if expired
    if (shareData.expires_at && new Date(shareData.expires_at) < new Date()) {
      return res.status(410).json({
        success: false,
        message: 'Share link has expired'
      });
    }
    
    // Update access count
    await db.query(
      'UPDATE college_shares SET access_count = access_count + 1 WHERE id = ?',
      [shareData.id]
    );
    
    // Get college details
    const [college] = await db.query(
      'SELECT id, name, code, location, affiliated_university, banner_image_url, website FROM colleges WHERE id = ?',
      [shareData.college_id]
    );
    
    let content = {
      college: college[0],
      share_type: shareData.share_type
    };
    
    // If document share, get document details
    if (shareData.share_type === 'document' && shareData.document_id) {
      const [document] = await db.query(
        'SELECT id, document_name, document_url, document_type, file_size, description, upload_date FROM college_documents WHERE id = ?',
        [shareData.document_id]
      );
      
      content.document = document[0];
    }
    
    res.status(200).json({
      success: true,
      data: content
    });
  } catch (error) {
    console.error('❌ Error accessing shared content:', error);
    res.status(500).json({
      success: false,
      message: 'Error accessing shared content',
      error: error.message
    });
  }
};

module.exports = {
  uploadDocument,
  getCollegeDocuments,
  getDocumentById,
  deleteDocument,
  generateShareToken,
  accessSharedContent
};