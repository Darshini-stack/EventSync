const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Resolve secure server uploads directory (outside of public static directories)
const uploadDir = path.resolve(__dirname, '../../uploads/proofs');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage configuration with random UUID filenames
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'].includes(ext) ? ext : '.png';
    const uniqueFilename = `proof_${crypto.randomUUID()}${safeExt}`;
    cb(null, uniqueFilename);
  },
});

// File format filter: strictly images and PDFs
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('Invalid proof format. Only JPEG, PNG, WEBP images and PDF files are allowed.');
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 Megabytes maximum
  },
});

// Poster upload directory and storage
const posterUploadDir = path.resolve(__dirname, '../../uploads/posters');
if (!fs.existsSync(posterUploadDir)) {
  fs.mkdirSync(posterUploadDir, { recursive: true });
}

const posterStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, posterUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.png';
    const uniqueFilename = `poster_${crypto.randomUUID()}${safeExt}`;
    cb(null, uniqueFilename);
  },
});

const posterFileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('Invalid poster format. Only JPEG, PNG, and WEBP images are allowed.');
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
};

const uploadPoster = multer({
  storage: posterStorage,
  fileFilter: posterFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB maximum
  },
});

module.exports = { upload, uploadDir, uploadPoster, posterUploadDir };

