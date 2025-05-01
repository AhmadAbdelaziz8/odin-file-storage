import { v2 as cloudinary } from "cloudinary";
import "dotenv/config"; // Make sure env vars are loaded

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, // Use https links
});

console.log(
  "Cloudinary configured with Cloud Name:",
  cloudinary.config().cloud_name
); // Verify
// Add a check:
if (
  !cloudinary.config().cloud_name ||
  !cloudinary.config().api_key ||
  !cloudinary.config().api_secret
) {
  console.error("Cloudinary environment variables missing!");
  // Optionally exit or throw error if critical
  // process.exit(1);
}
