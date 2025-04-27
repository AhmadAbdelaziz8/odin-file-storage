import bcrypt from "bcrypt";
import { PrismaClient } from "../../generated/prisma/index.js";

const prisma = new PrismaClient();

export const registerUser = async (req, res, next) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Missing username or password" });
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: {
        username: username,
      },
    });

    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        username: username,
        password: hashedPassword,
      },
    });
    res
      .status(201)
      .json({ message: "User registered successfully", userId: newUser.id });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const loginUser = async (req, res, next) => {
  console.log(`${req.user.username} logged in successfully via controller.`);

  res.json({
    message: `Welcome ${req.user.username}!`,
    user: {
      id: req.user.id,
      username: req.user.username,
    },
  });
};

export const logoutUser = (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destruction error:", err);
        // Even if session destruction fails, try to clear cookie and respond
        // Might indicate a store issue, but user should still perceive logout
      }
      // Ensure the cookie name matches your session configuration
      res.clearCookie("connect.sid");
      console.log("User logged out via controller.");
      res
        .status(200)
        .json({ message: "You have been logged out successfully." });
    });
  });
};
