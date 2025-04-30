import express from "express";
import session from "express-session";
import { PrismaClient } from "../generated/prisma/index.js";
import { PrismaSessionStore } from "@quixo3/prisma-session-store";
import passport from "passport";
import dotenv from "dotenv";

// Import configurations and routes
import configurePassport from "./config/passport.js";
import authRoutes from "./routes/auth.route.js";
import folderRoutes from "./routes/folders.js";

dotenv.config(); // Load .env variables

const app = express();
const prisma = new PrismaClient();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    },
    store: new PrismaSessionStore(prisma, {
      checkPeriod: 2 * 60 * 1000,
      dbRecordIdIsSessionId: true,
      dbRecordIdFunction: undefined,
    }),
  })
);

app.use(passport.initialize());
app.use(passport.session());

configurePassport(); // Fixed: removed unnecessary passport parameter

app.use((req, res, next) => {
  console.log("--- Request Check ---");
  console.log("Method:", req.method);
  console.log("URL:", req.originalUrl);
  console.log("Headers:", req.headers);
  console.log("Body Parsed?:", req.body);
  console.log("--- End Check ---");
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/folders", folderRoutes);
app.get("/api/hello", (req, res) => {
  res.send("API is running!");
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  // Check for specific error types if needed
  res.status(err.status || 500).json({
    message: err.message || "Something went wrong!",
    // Optionally include stack trace in development
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Auth routes available at /api/auth`);
});
