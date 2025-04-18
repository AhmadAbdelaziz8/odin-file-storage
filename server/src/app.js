import express from "express";
import session from "express-session";
import { PrismaClient } from "@prisma/client";
import { PrismaSessionStore } from "@quixo3/prisma-session-store";
import passport from "passport";
import dotenv from "dotenv"; // For environment variables

// Import configurations and routes
import configurePassport from "./config/passport.js"; // Our passport config function
import authRoutes from "./routes/auth.routes.js"; // Our auth routes

dotenv.config(); // Load .env variables

const app = express();
const prisma = new PrismaClient();

// --- Middleware Setup ---

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default_secret_key", // Use env variable!
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      // Add httpOnly: true for security (recommended)
      // httpOnly: true,
    },
    store: new PrismaSessionStore(prisma, {
      checkPeriod: 2 * 60 * 1000,
      dbRecordIdIsSessionId: true,
      dbRecordIdFunction: undefined,
    }),
  })
);

// Passport Initialization (AFTER session)
app.use(passport.initialize());
app.use(passport.session());

// Configure Passport Strategies (call the function we exported)
configurePassport(passport);

// --- Routes Setup ---
// Use a base path for API routes (good practice)
app.use("/api/auth", authRoutes); // Mount the authentication routes

// Simple route for testing
app.get("/api/hello", (req, res) => {
  res.send("API is running!");
});

// --- Error Handling Middleware (Place after routes) ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  // Check for specific error types if needed
  res.status(err.status || 500).json({
    message: err.message || "Something went wrong!",
    // Optionally include stack trace in development
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Auth routes available at /api/auth`);
});
