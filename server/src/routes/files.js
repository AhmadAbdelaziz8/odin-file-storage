import express from "express";
import { PrismaClient } from "../../generated/prisma/index.js";
import multer from "multer";
import streamifier from "streamifier";
import ensureAuthenticated from "../middleware/auth.middleware.js";
import { uploadToCloudinary } from "../utils/cloudinary.util.js";

const prisma = new PrismaClient();
const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 10 }, // 10MB limit
});

// Get all files for the current user
router.get("/", ensureAuthenticated, async (req, res, next) => {
  const userId = req.user.id;
  const { folderId } = req.query;

  let whereClause = { userId: userId };

  if (folderId) {
    if (folderId === "root") {
      whereClause.folderId = null;
    } else {
      const folderIdInt = parseInt(folderId, 10);
      if (isNaN(folderIdInt)) {
        return res.status(400).json({ message: "Invalid folder ID format." });
      }
      whereClause.folderId = folderIdInt;
    }
  }

  try {
    const files = await prisma.file.findMany({
      where: whereClause,
      orderBy: {
        createdAt: "desc",
      },
    });
    res.status(200).json(files);
  } catch (error) {
    next(error);
  }
});

// Get a specific file
router.get("/:fileId", ensureAuthenticated, async (req, res, next) => {
  const userId = req.user.id;
  const { fileId } = req.params;
  const fileIdInt = parseInt(fileId, 10);

  if (isNaN(fileIdInt)) {
    return res.status(400).json({ message: "Invalid file ID format." });
  }

  try {
    const file = await prisma.file.findUnique({
      where: {
        id: fileIdInt,
        userId: userId,
      },
    });

    if (!file) {
      return res
        .status(404)
        .json({ message: "File not found or access denied." });
    }

    res.status(200).json(file);
  } catch (error) {
    next(error);
  }
});

// Upload a file
router.post(
  "/",
  ensureAuthenticated,
  upload.single("uploadedFile"),
  async (req, res, next) => {
    if (!req.file) {
      return res.status(400).send("No file uploaded.");
    }

    const { folderId } = req.body;
    const userId = req.user.id;
    let targetFolderId = null;

    // Validate folder if provided
    if (folderId && folderId.trim() !== "") {
      const folderIdInt = parseInt(folderId, 10);
      if (isNaN(folderIdInt)) {
        return res.status(400).json({ message: "Invalid folder ID format." });
      }
      
      try {
        const folder = await prisma.folder.findUnique({
          where: { id: folderIdInt, userId: userId },
        });
        
        if (!folder) {
          return res.status(404).json({ 
            message: "Target folder not found or access denied." 
          });
        }
        
        targetFolderId = folderIdInt;
      } catch (error) {
        console.error("DB Error folder check:", error);
        return res.status(500).json({ 
          message: "Database error checking folder." 
        });
      }
    }

    try {
      // Upload to Cloudinary
      const uploadResult = await uploadToCloudinary(req.file.buffer);
      
      // Save file metadata to database
      const newFile = await prisma.file.create({
        data: {
          filename: req.file.originalname,
          storedFilename: uploadResult.public_id,
          path: uploadResult.secure_url,
          mimetype: req.file.mimetype,
          size: req.file.size,
          userId: userId,
          folderId: targetFolderId,
        },
      });
      
      res.status(201).json(newFile);
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: "Error uploading file" });
    }
  }
);

// Update file (move to folder)
router.patch("/:fileId", ensureAuthenticated, async (req, res, next) => {
  const userId = req.user.id;
  const { fileId } = req.params;
  const { folderId } = req.body;
  const fileIdInt = parseInt(fileId, 10);

  if (isNaN(fileIdInt)) {
    return res.status(400).json({ message: "Invalid file ID format." });
  }

  let targetFolderId = null;
  
  // Validate folder if not null
  if (folderId !== null && folderId !== undefined) {
    if (folderId === "root") {
      // Special case - move to root (no folder)
      targetFolderId = null;
    } else {
      const folderIdInt = parseInt(folderId, 10);
      if (isNaN(folderIdInt)) {
        return res.status(400).json({ message: "Invalid folder ID format." });
      }
      
      try {
        const folder = await prisma.folder.findUnique({
          where: { id: folderIdInt, userId: userId },
        });
        
        if (!folder) {
          return res.status(404).json({ 
            message: "Target folder not found or access denied." 
          });
        }
        
        targetFolderId = folderIdInt;
      } catch (error) {
        return res.status(500).json({ message: "Database error." });
      }
    }
  }

  try {
    // Check if file exists and belongs to user
    const file = await prisma.file.findUnique({
      where: { id: fileIdInt },
    });
    
    if (!file || file.userId !== userId) {
      return res.status(404).json({ 
        message: "File not found or access denied." 
      });
    }
    
    // Update file
    const updatedFile = await prisma.file.update({
      where: { id: fileIdInt },
      data: { folderId: targetFolderId },
    });
    
    res.status(200).json(updatedFile);
  } catch (error) {
    next(error);
  }
});

// Delete file
router.delete("/:fileId", ensureAuthenticated, async (req, res, next) => {
  const userId = req.user.id;
  const { fileId } = req.params;
  const fileIdInt = parseInt(fileId, 10);

  if (isNaN(fileIdInt)) {
    return res.status(400).json({ message: "Invalid file ID format." });
  }

  try {
    // Check if file exists and belongs to user
    const file = await prisma.file.findUnique({
      where: { id: fileIdInt },
    });
    
    if (!file || file.userId !== userId) {
      return res.status(404).json({ 
        message: "File not found or access denied." 
      });
    }
    
    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(file.storedFilename);
    } catch (cloudinaryError) {
      console.error("Cloudinary deletion error:", cloudinaryError);
      // Continue with database deletion even if Cloudinary fails
    }
    
    // Delete from database
    await prisma.file.delete({
      where: { id: fileIdInt },
    });
    
    res.status(200).json({ message: "File deleted successfully" });
  } catch (error) {
    next(error);
  }
});

export default router;
