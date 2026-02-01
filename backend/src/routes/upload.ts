import { Router, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { authenticateTeacher } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Allowed file types for upload
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/jpg',
  'application/pdf'
];

// Configure multer for memory storage (files stored in memory buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size (increased for PDFs)
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG images and PDF files are allowed'));
    }
  },
});

// Upload file (image or PDF) to Cloudinary
router.post('/image', authenticateTeacher, upload.single('image'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(500).json({ error: 'Cloudinary is not configured' });
    }

    const isPdf = req.file.mimetype === 'application/pdf';
    const fileType: 'image' | 'pdf' = isPdf ? 'pdf' : 'image';

    // Upload to Cloudinary using stream
    const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
      // Configure upload options based on file type
      const uploadOptions: any = {
        folder: 'lara-tasks',
      };

      if (isPdf) {
        // PDFs use 'raw' resource type in Cloudinary
        uploadOptions.resource_type = 'raw';
      } else {
        // Images use standard image handling with transformations
        uploadOptions.resource_type = 'image';
        uploadOptions.transformation = [
          { width: 1200, height: 800, crop: 'limit' }, // Limit max dimensions
          { quality: 'auto:good' }, // Auto quality optimization
        ];
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            reject(error);
          } else if (result) {
            resolve({ secure_url: result.secure_url, public_id: result.public_id });
          } else {
            reject(new Error('Upload failed'));
          }
        }
      );

      uploadStream.end(req.file!.buffer);
    });

    return res.json({
      url: result.secure_url,
      publicId: result.public_id,
      fileType: fileType,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message || 'Failed to upload file' });
  }
});

// Delete file (image or PDF) from Cloudinary
router.delete('/image/:publicId', authenticateTeacher, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicId = req.params.publicId;
    const resourceType = req.query.type === 'pdf' ? 'raw' : 'image';

    await cloudinary.uploader.destroy(`lara-tasks/${publicId}`, { resource_type: resourceType });

    return res.json({ deleted: true });
  } catch (error: any) {
    console.error('Delete error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete file' });
  }
});

export default router;
