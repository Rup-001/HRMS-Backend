// const multer = require('multer');
// const path = require('path');
// const fs = require('fs').promises;

// const uploadDir = 'Uploads/';
// fs.mkdir(uploadDir, { recursive: true }).catch(err => {
//   console.error('Error creating uploads directory:', err);
// });

// const storage = multer.memoryStorage();

// const imageFilter = (req, file, cb) => {
//   const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/jpg'];
//   console.log('Multer file type check:', { mimetype: file.mimetype, allowed: allowedTypes.includes(file.mimetype) });
//   if (allowedTypes.includes(file.mimetype)) {
//     cb(null, true);
//   } else {
//     cb(new Error('Only JPEG, PNG, GIF, and JPG images are allowed'), false);
//   }
// };

// const documentFilter = (req, file, cb) => {
//   const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
//   console.log('Multer document type check:', { mimetype: file.mimetype, allowed: allowedTypes.includes(file.mimetype) });
//   if (allowedTypes.includes(file.mimetype)) {
//     cb(null, true);
//   } else {
//     cb(new Error('Only PDF, DOC, and DOCX files are allowed'), false);
//   }
// };

// exports.uploadFiles = multer({
//   storage,
//   limits: { fileSize: 10 * 1024 * 1024, fieldSize: 10 * 1024 * 1024 },
//   fileFilter: (req, file, cb) => {
//     console.log('Received file field:', file.fieldname);
//     if (file.fieldname === 'passportSizePhoto') {
//       imageFilter(req, file, cb);
//     } else {
//       documentFilter(req, file, cb);
//     }
//   }
// }).fields([
//   { name: 'passportSizePhoto', maxCount: 1 },
//   { name: 'appointmentLetter', maxCount: 1 },
//   { name: 'resume', maxCount: 1 },
//   { name: 'nidCopy', maxCount: 1 },
//   { name: 'document', maxCount: 1 }
// ]);


const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create upload directories dynamically if not exist
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'Uploads/others'; // default folder

    switch (file.fieldname) {
      case 'passportSizePhoto':
        folder = 'Uploads/passportSizePhoto';
        break;
      case 'appointmentLetter':
        folder = 'Uploads/appointmentLetter';
        break;
      case 'resume':
        folder = 'Uploads/resume';
        break;
      case 'nidCopy':
        folder = 'Uploads/nidCopy';
        break;
      case 'document':
        folder = 'Uploads/document';
        break;
    }

    ensureDir(folder);
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// File filters remain the same
const imageFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/jpg'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, GIF, and JPG images are allowed'), false);
  }
};

const documentFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, DOC, and DOCX files are allowed'), false);
  }
};

exports.uploadFiles = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, fieldSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'passportSizePhoto') {
      imageFilter(req, file, cb);
    } else {
      documentFilter(req, file, cb);
    }
  }
}).fields([
  { name: 'passportSizePhoto', maxCount: 1 },
  { name: 'appointmentLetter', maxCount: 1 },
  { name: 'resume', maxCount: 1 },
  { name: 'nidCopy', maxCount: 1 },
  { name: 'document', maxCount: 1 }
]);
