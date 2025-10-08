// const mongoose = require('mongoose');
// const multer = require('multer');
// const Document = require('../models/document');
// const fs = require('fs').promises;
// const path = require('path');
// const { uploadFiles } = require('../middleware/upload');

// exports.uploadDocument = async (req, res) => {
//   let document = null;
//   let uploadedFiles = {};

//   try {
//     // Validate user authentication
//     if (!req.user || !req.user._id) {
//       throw new Error('User authentication required');
//     }

//     // Handle file upload
//     await new Promise((resolve, reject) => {
//       uploadFiles(req, res, (err) => {
//         if (err) {
//           console.error('uploadDocument - Upload error:', err);
//           reject(err instanceof multer.MulterError
//             ? new Error(`Upload error: ${err.message}`)
//             : err);
//         } else {
//           console.log('uploadDocument - Files received:', Object.keys(req.files || {}));
//           resolve();
//         }
//       });
//     });

//     const { employeeId, companyId, documentType, description } = req.body;
//     const files = req.files;

//     // Validate required fields
//     if (!employeeId || !companyId || !documentType || !files) {
//       throw new Error('Missing required fields: employeeId, companyId, documentType, and at least one file');
//     }

//     // Validate documentType
//     const validDocumentTypes = ['contract', 'offer_letter', 'id_proof', 'certificate', 'other'];
//     if (!validDocumentTypes.includes(documentType)) {
//       throw new Error('Invalid document type');
//     }

//     // Validate MongoDB ObjectIds
//     if (!mongoose.Types.ObjectId.isValid(employeeId) || !mongoose.Types.ObjectId.isValid(companyId)) {
//       throw new Error('Invalid employeeId or companyId format');
//     }

//     // Process each uploaded file
//     const uploadedDocuments = [];
//     const allowedFields = ['passportSizePhoto', 'appointmentLetter', 'resume', 'nidCopy', 'document'];
//     for (const fieldName of Object.keys(files)) {
//       if (!allowedFields.includes(fieldName)) {
//         throw new Error(`Invalid field name: ${fieldName}`);
//       }
//       const file = files[fieldName][0]; // Get first file for each field
//       const filePath = path.join('Uploads', `${Date.now()}-${file.originalname}`).replace(/\\/g, '/');
      
//       // Save file to disk
//       await fs.writeFile(path.join(__dirname, '..', filePath), file.buffer);
//       console.log('uploadDocument - File saved to disk:', filePath);
//       uploadedFiles[fieldName] = filePath;

//       // Create document record
//       document = new Document({
//         companyId,
//         employeeId,
//         documentType,
//         fileUrl: `/${filePath}`,
//         uploadedBy: req.user._id,
//         description,
//         fileName: file.originalname,
//         mimeType: file.mimetype,
//         size: file.size
//       });

//       await document.save();
//       console.log('uploadDocument - Saved document:', {
//         _id: document._id,
//         fileUrl: document.fileUrl,
//         documentType,
//         fileName: file.originalname
//       });
//       uploadedDocuments.push({
//         _id: document._id,
//         fileUrl: document.fileUrl,
//         documentType,
//         fileName: file.originalname
//       });
//     }

//     res.status(201).json({
//       success: true,
//       message: 'Documents uploaded successfully',
//       count: uploadedDocuments.length,
//       data: uploadedDocuments
//     });

//   } catch (error) {
//     console.error('uploadDocument - Error:', error);

//     // Cleanup on error
//     if (document) {
//       await Document.deleteOne({ _id: document._id });
//       console.log('uploadDocument - Rolled back document:', document._id);
//     }
//     for (const [field, filePath] of Object.entries(uploadedFiles)) {
//       try {
//         await fs.unlink(path.join(__dirname, '..', filePath));
//         console.log(`uploadDocument - Rolled back ${field}:`, filePath);
//       } catch (fsErr) {
//         console.error(`uploadDocument - Error deleting ${field}:`, fsErr);
//       }
//     }

//     res.status(error.message.includes('not found') ? 404 : 400).json({
//       success: false,
//       error: error.message,
//       code: error instanceof multer.MulterError ? 'MULTER_ERROR' : 'GENERAL_ERROR'
//     });
//   } finally {
//     console.log('uploadDocument - Execution completed');
//   }
// };

// exports.getDocuments = async (req, res) => {
//   try {
//     const { employeeId, companyId } = req.query;
//     const query = {};

//     // Validate and add query parameters
//     if (employeeId) {
//       if (!mongoose.Types.ObjectId.isValid(employeeId)) {
//         throw new Error('Invalid employeeId format');
//       }
//       query.employeeId = employeeId;
//     }
//     if (companyId) {
//       if (!mongoose.Types.ObjectId.isValid(companyId)) {
//         throw new Error('Invalid companyId format');
//       }
//       query.companyId = companyId;
//     }

//     const documents = await Document.find(query)
//       .populate('employeeId', 'fullName newEmployeeCode')
//       .populate('uploadedBy', 'email')
//       .lean()
//       .exec();

//     res.status(200).json({
//       success: true,
//       count: documents.length,
//       data: documents
//     });
//   } catch (error) {
//     console.error('getDocuments - Error:', error);
//     res.status(error.message.includes('not found') ? 404 : 400).json({
//       success: false,
//       error: error.message,
//       code: 'GENERAL_ERROR'
//     });
//   } finally {
//     console.log('getDocuments - Execution completed');
//   }
// };

// exports.getDocumentById = async (req, res) => {
//   try {
//     const { id } = req.params;

//     // Validate ObjectId
//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       throw new Error('Invalid document ID format');
//     }

//     const document = await Document.findById(id)
//       .populate('employeeId', 'fullName newEmployeeCode')
//       .populate('uploadedBy', 'email')
//       .lean()
//       .exec();

//     if (!document) {
//       throw new Error('Document not found');
//     }

//     res.status(200).json({
//       success: true,
//       data: document
//     });
//   } catch (error) {
//     console.error('getDocumentById - Error:', error);
//     res.status(error.message === 'Document not found' ? 404 : 400).json({
//       success: false,
//       error: error.message,
//       code: error.message === 'Document not found' ? 'NOT_FOUND' : 'GENERAL_ERROR'
//     });
//   } finally {
//     console.log('getDocumentById - Execution completed');
//   }
// };


const mongoose = require('mongoose');
const multer = require('multer');
const Document = require('../models/document');
const fs = require('fs').promises;
const path = require('path');
const { uploadFiles } = require('../middleware/upload');

exports.uploadDocument = async (req, res) => {
  let document = null;
  let uploadedFiles = {};

  try {
    // Validate user authentication
    if (!req.user || !req.user._id) {
      throw new Error('User authentication required');
    }

    // Handle file upload
    await new Promise((resolve, reject) => {
      uploadFiles(req, res, (err) => {
        if (err) {
          console.error('uploadDocument - Upload error:', err);
          reject(err instanceof multer.MulterError
            ? new Error(`Upload error: ${err.message}`)
            : err);
        } else {
          console.log('uploadDocument - Files received:', Object.keys(req.files || {}));
          resolve();
        }
      });
    });

    const { employeeId, companyId, documentType, description } = req.body;
    const files = req.files;

    // Validate required fields
    if (!employeeId || !companyId || !documentType || !files) {
      throw new Error('Missing required fields: employeeId, companyId, documentType, and at least one file');
    }

    // Validate documentType
    const validDocumentTypes = ['contract', 'offer_letter', 'id_proof', 'certificate', 'other'];
    if (!validDocumentTypes.includes(documentType)) {
      throw new Error('Invalid document type');
    }

    // Validate MongoDB ObjectIds
    if (!mongoose.Types.ObjectId.isValid(employeeId) || !mongoose.Types.ObjectId.isValid(companyId)) {
      throw new Error('Invalid employeeId or companyId format');
    }

    // Process each uploaded file
    const uploadedDocuments = [];
    const allowedFields = ['passportSizePhoto', 'appointmentLetter', 'resume', 'nidCopy', 'document'];
    for (const fieldName of Object.keys(files)) {
      if (!allowedFields.includes(fieldName)) {
        throw new Error(`Invalid field name: ${fieldName}`);
      }
      const file = files[fieldName][0]; // Get first file for each field

      // Multer already saved the file, just grab the path
      const filePath = file.path.replace(/\\/g, '/');
      uploadedFiles[fieldName] = filePath;

      // Create document record
      document = new Document({
        companyId,
        employeeId,
        documentType,
        fileUrl: `/${filePath}`,   // saved as relative path for serving
        uploadedBy: req.user._id,
        description,
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size
      });

      await document.save();
      console.log('uploadDocument - Saved document:', {
        _id: document._id,
        fileUrl: document.fileUrl,
        documentType,
        fileName: file.originalname
      });
      uploadedDocuments.push({
        _id: document._id,
        fileUrl: document.fileUrl,
        documentType,
        fileName: document.originalname
      });
    }

    res.status(201).json({
      success: true,
      message: 'Documents uploaded successfully',
      count: uploadedDocuments.length,
      data: uploadedDocuments
    });

  } catch (error) {
    console.error('uploadDocument - Error:', error);

    // Cleanup on error
    if (document) {
      await Document.deleteOne({ _id: document._id });
      console.log('uploadDocument - Rolled back document:', document._id);
    }
    for (const [field, filePath] of Object.entries(uploadedFiles)) {
      try {
        await fs.unlink(path.join(__dirname, '..', filePath));
        console.log(`uploadDocument - Rolled back ${field}:`, filePath);
      } catch (fsErr) {
        console.error(`uploadDocument - Error deleting ${field}:`, fsErr);
      }
    }

    res.status(error.message.includes('not found') ? 404 : 400).json({
      success: false,
      error: error.message,
      code: error instanceof multer.MulterError ? 'MULTER_ERROR' : 'GENERAL_ERROR'
    });
  } finally {
    console.log('uploadDocument - Execution completed');
  }
};

exports.getDocuments = async (req, res) => {
  try {
    const { employeeId, companyId } = req.query;
    const query = {};

    // Validate and add query parameters
    if (employeeId) {
      if (!mongoose.Types.ObjectId.isValid(employeeId)) {
        throw new Error('Invalid employeeId format');
      }
      query.employeeId = employeeId;
    }
    if (companyId) {
      if (!mongoose.Types.ObjectId.isValid(companyId)) {
        throw new Error('Invalid companyId format');
      }
      query.companyId = companyId;
    }

    const documents = await Document.find(query)
      .populate('employeeId', 'fullName newEmployeeCode')
      .populate('uploadedBy', 'email')
      .lean()
      .exec();

    res.status(200).json({
      success: true,
      count: documents.length,
      data: documents
    });
  } catch (error) {
    console.error('getDocuments - Error:', error);
    res.status(error.message.includes('not found') ? 404 : 400).json({
      success: false,
      error: error.message,
      code: 'GENERAL_ERROR'
    });
  } finally {
    console.log('getDocuments - Execution completed');
  }
};

exports.getDocumentById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid document ID format');
    }

    const document = await Document.findById(id)
      .populate('employeeId', 'fullName newEmployeeCode')
      .populate('uploadedBy', 'email')
      .lean()
      .exec();

    if (!document) {
      throw new Error('Document not found');
    }

    res.status(200).json({
      success: true,
      data: document
    });
  } catch (error) {
    console.error('getDocumentById - Error:', error);
    res.status(error.message === 'Document not found' ? 404 : 400).json({
      success: false,
      error: error.message,
      code: error.message === 'Document not found' ? 'NOT_FOUND' : 'GENERAL_ERROR'
    });
  } finally {
    console.log('getDocumentById - Execution completed');
  }
};
