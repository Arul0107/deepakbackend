// backend/routes/collegeRoutes.js
const express = require('express');
const router = express.Router();
const collegeController = require('../controllers/collegeController');
const documentController = require('../controllers/documentController');
const { uploadBanner, uploadDocument } = require('../config/upload');

// College routes
router.get('/', collegeController.getColleges);
router.get('/:id', collegeController.getCollegeById);
router.post('/', uploadBanner.single('banner'), collegeController.createCollege);
router.put('/:id', uploadBanner.single('banner'), collegeController.updateCollege);
router.delete('/:id', collegeController.deleteCollege);

// Document routes
router.post('/documents/upload', uploadDocument.single('document'), documentController.uploadDocument);
router.get('/documents/college/:college_id', documentController.getCollegeDocuments);
router.get('/documents/:id', documentController.getDocumentById);
router.delete('/documents/:id', documentController.deleteDocument);

// Share routes
router.post('/share/generate', documentController.generateShareToken);
router.get('/share/:token', documentController.accessSharedContent);

module.exports = router;