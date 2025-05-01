import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import "dotenv/config";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Validate Cloudinary configuration
if (
  !cloudinary.config().cloud_name ||
  !cloudinary.config().api_key ||
  !cloudinary.config().api_secret
) {
  console.error("Cloudinary environment variables missing!");
}

// Upload file buffer to Cloudinary
const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {},
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};

export { cloudinary, uploadToCloudinary };