// backend/config/upload.js
const multer = require('multer');

// Use memory storage to get file buffer for Supabase upload
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Allow images for banner
  if (file.fieldname === 'banner') {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for banner!'), false);
    }
  }
  // Allow PDFs for documents
  else if (file.fieldname === 'document') {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed for documents!'), false);
    }
  }
  else {
    cb(null, true);
  }
};

const uploadBanner = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for banner
  fileFilter: fileFilter
});

const uploadDocument = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for documents
  fileFilter: fileFilter
});

module.exports = { uploadBanner, uploadDocument };