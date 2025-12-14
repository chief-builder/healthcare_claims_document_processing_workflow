/**
 * File upload middleware using multer
 */

import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import path from 'path';
import { ApiError } from './error.js';

/**
 * Allowed MIME types for document uploads
 */
const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/tiff',
  'image/gif',
  'application/pdf',
];

/**
 * Allowed file extensions
 */
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.tiff', '.tif', '.gif', '.pdf'];

/**
 * Maximum file size (10MB)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * File filter function
 */
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  callback: FileFilterCallback
): void => {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    callback(
      ApiError.badRequest(
        `Invalid file type: ${file.mimetype}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`
      )
    );
    return;
  }

  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    callback(
      ApiError.badRequest(
        `Invalid file extension: ${ext}. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`
      )
    );
    return;
  }

  callback(null, true);
};

/**
 * Memory storage configuration (files stored in buffer)
 */
const storage = multer.memoryStorage();

/**
 * Multer upload middleware for single document upload
 */
export const uploadDocument = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
}).single('document');

/**
 * Multer upload middleware for multiple documents
 */
export const uploadDocuments = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10,
  },
}).array('documents', 10);

/**
 * Helper to get uploaded file from request
 */
export interface UploadedFile {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  size: number;
}

export const getUploadedFile = (req: Request): UploadedFile | null => {
  const file = req.file;
  if (!file) {
    return null;
  }

  return {
    buffer: file.buffer,
    filename: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  };
};

export const getUploadedFiles = (req: Request): UploadedFile[] => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || !Array.isArray(files)) {
    return [];
  }

  return files.map((file) => ({
    buffer: file.buffer,
    filename: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  }));
};

/**
 * Configuration exports
 */
export const uploadConfig = {
  allowedMimeTypes: ALLOWED_MIME_TYPES,
  allowedExtensions: ALLOWED_EXTENSIONS,
  maxFileSize: MAX_FILE_SIZE,
};
