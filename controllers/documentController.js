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
    if (!req.user || !req.user._id) {
      throw new Error('User authentication required');
    }

    await new Promise((resolve, reject) => {
      uploadFiles(req, res, (err) => {
        if (err) {
          console.error('uploadDocument - Upload error:', err);
          reject(err instanceof multer.MulterError
            ? new Error(`Upload error: ${err.message}`)
            : err);
        } else {
          resolve();
        }
      });
    });

    const { employeeId, companyId, documentType, description, isCommon } = req.body;
    const files = req.files;

    if (!companyId || !documentType || !files) {
      throw new Error('Missing required fields: companyId, documentType, and at least one file');
    }

    if (isCommon !== 'true' && !employeeId) {
        throw new Error('Missing required field: employeeId is required for non-common documents');
    }

    const validDocumentTypes = ['contract', 'offer_letter', 'id_proof', 'certificate', 'other', 'policy'];
    if (!validDocumentTypes.includes(documentType)) {
      throw new Error('Invalid document type');
    }

    if (employeeId && !mongoose.Types.ObjectId.isValid(employeeId)) {
        throw new Error('Invalid employeeId or companyId format');
    }

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
        throw new Error('Invalid employeeId or companyId format');
    }

    const uploadedDocuments = [];
    const allowedFields = ['passportSizePhoto', 'appointmentLetter', 'resume', 'nidCopy', 'document'];
    for (const fieldName of Object.keys(files)) {
      if (!allowedFields.includes(fieldName)) {
        throw new Error(`Invalid field name: ${fieldName}`);
      }
      const file = files[fieldName][0];

      const filePath = file.path.replace(/\\/g, '/');
      uploadedFiles[fieldName] = filePath;

      document = new Document({
        companyId,
        employeeId: isCommon === 'true' ? undefined : employeeId,
        documentType,
        fileUrl: `/${filePath}`,
        uploadedBy: req.user._id,
        description,
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        isCommon: isCommon === 'true',
      });

      await document.save();
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

    if (document) {
      await Document.deleteOne({ _id: document._id });
    }
    for (const [field, filePath] of Object.entries(uploadedFiles)) {
      try {
        await fs.unlink(path.join(__dirname, '..', filePath));
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
      .populate('companyId', 'name')                    // <-- Add this
      .populate('uploadedBy', 'fullName email')         // <-- One line, both fields
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

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid document ID format');
    }

    const document = await Document.findById(id)
      .populate('employeeId', 'fullName newEmployeeCode')
      .populate('companyId', 'name')                    // <-- Add this
      .populate('uploadedBy', 'fullName email')         // <-- One line
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

exports.getCommonDocuments = async (req, res) => {
  try {
    const documents = await Document.find({ isCommon: true, companyId: req.user.companyId })
      .populate('uploadedBy', 'fullName email')
      .lean()
      .exec();

    res.status(200).json({
      success: true,
      count: documents.length,
      data: documents
    });
  } catch (error) {
    console.error('getCommonDocuments - Error:', error);
    res.status(400).json({
      success: false,
      error: error.message,
      code: 'GENERAL_ERROR'
    });
  } finally {
    console.log('getCommonDocuments - Execution completed');
  }
};

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
//       .populate('uploadedBy', 'fullName')
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
//       .populate('uploadedBy', 'fullName')
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
