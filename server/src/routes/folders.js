import express from "express";
import { PrismaClient } from "../../generated/prisma/index.js";

const prisma = new PrismaClient();
const router = express.Router();

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    // Assumes Passport is setup
    return next();
  }
  res.status(401).json({ message: "Authentication required" });
}
router.use(ensureAuthenticated);

// Get all folders for the current user
router.get("/", async (req, res, next) => {
  const userId = req.user.id;
  
  try {
    const folders = await prisma.folder.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        name: "asc",
      },
    });
    
    res.status(200).json(folders);
  } catch (error) {
    next(error);
  }
});

// Create folder
router.post("/", async (req, res, next) => {
  const { name } = req.body;
  const userId = req.user.id;  // Fixed: userId extraction

  if (!name || typeof name !== "string" || name.length === 0) {  // Fixed: type check
    return res.status(400).json({ message: "folder must have a valid name" });
  }

  const trimmedName = name.trim();
  try {
    const existingFolder = await prisma.folder.findFirst({  // Fixed: Prisma method name
      where: {
        name: trimmedName,
        userId: userId,
      },
    });

    if (existingFolder) {
      return res.status(409).json({ message: "folder already exists" });
    }

    const folder = await prisma.folder.create({
      data: {
        name: trimmedName,
        userId: userId,
      },
    });
    res.status(201).json(folder);
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "folder already exists" });
    }
    console.error("Error creating folder:", error);
    next(error);
  }
});

// Get specific folder
router.get("/:folderId", async (req, res, next) => {  // Fixed: route parameter syntax
  const userId = req.user.id;
  const { folderId } = req.params;
  const folderIdInt = parseInt(folderId, 10);  // Fixed: variable name

  if (isNaN(FolderIdInt)) {
    return res.status(400).json({ message: "Invalid folder ID format." });
  }

  try {
    const folder = await prisma.folder.findUnique({  // Fixed: Prisma client variable name
      where: {
        id: FolderIdInt,
        userId: userId,
      },

      include: {
        files: {
          orderBy: {
            filename: "asc",
          },
        },
      },
    });

    if (!folder) {
      return res.status(400).json({ message: "folder not found" });
    }

    res.status(200).json(folder);
  } catch (error) {
    next(error);
  }
});

router.patch("/:folderId", async (req, res, next) => {
  const userId = req.user.id;
  const { folderId } = req.params;
  const { name } = req.body;
  const folderIdInt = parseInt(folderId, 10);

  if (isNaN(folderIdInt)) {
    return res.status(400).json({ message: "Invalid folder ID format." });
  }

  // Basic validation for the new name
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res
      .status(400)
      .json({
        message: "New folder name is required and must be a non-empty string.",
      });
  }
  const trimmedName = name.trim();

  try {
    // Check if the target folder exists and belongs to the user
    const currentFolder = await prisma.folder.findUnique({
      where: { id: folderIdInt },
    });

    if (!currentFolder || currentFolder.userId !== userId) {
      return res
        .status(404)
        .json({ message: "Folder not found or access denied." });
    }

    // Check if the new name conflicts with an existing folder for the same user
    if (trimmedName !== currentFolder.name) {
      // Only check if name is actually changing
      const existingFolder = await prisma.folder.findFirst({
        where: {
          userId: userId,
          name: trimmedName,
          id: { not: folderIdInt }, // Exclude the current folder itself
        },
      });

      if (existingFolder) {
        return res
          .status(409)
          .json({
            message: `Another folder with name "${trimmedName}" already exists.`,
          });
      }
    }

    // Update the folder name
    const updatedFolder = await prisma.folder.update({
      where: {
        // We know it exists and belongs to user from check above
        id: folderIdInt,
      },
      data: {
        name: trimmedName,
      },
    });
    res.status(200).json(updatedFolder);
  } catch (error) {
    // Handle potential Prisma unique constraint errors during update
    if (
      error.code === "P2002" &&
      error.meta?.target?.includes("userId") &&
      error.meta?.target?.includes("name")
    ) {
      return res
        .status(409)
        .json({
          message: `Another folder with name "${trimmedName}" already exists.`,
        });
    }
    next(error);
  }
});

// --- 5. DELETE a folder ---
router.delete("/:folderId", async (req, res, next) => {
  const userId = req.user.id;
  const { folderId } = req.params;
  const folderIdInt = parseInt(folderId, 10);

  if (isNaN(folderIdInt)) {
    return res.status(400).json({ message: "Invalid folder ID format." });
  }

  try {
    // We need to ensure the folder belongs to the user *before* deleting.
    // Using deleteMany allows filtering by userId directly.
    const deleteResult = await prisma.folder.deleteMany({
      where: {
        id: folderIdInt,
        userId: userId, // Ensures only the owner can delete
      },
    });

    // deleteMany returns a count of deleted records.
    if (deleteResult.count === 0) {
      // This means either the folder didn't exist or it didn't belong to the user.
      return res
        .status(404)
        .json({ message: "Folder not found or access denied." });
    }

    // Remember: Files inside the folder will have their folderId set to null
    // due to `onDelete: SetNull` in the schema. They are NOT deleted.
    res.status(204).send(); // 204 No Content is standard for successful DELETE
  } catch (error) {
    next(error);
  }
});

export default router;
