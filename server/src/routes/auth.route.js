import express from "express";
import passport from "passport";
import * as authController from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/register", authController.registerUser);
router.post("/login", passport.authenticate("local"), authController.loginUser);
router.get("/logout", authController.logoutUser);

export default router;
