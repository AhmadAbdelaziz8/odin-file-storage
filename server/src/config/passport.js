import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { User } from "../models/user";  
import {PrismaClient} from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

passport.use( new LocalStrategy(
    async(username, password,done) =>{ 
        try {
            const user = await prisma.user.findUnique({
                where: {
                    username: username,
                },
            });

            if (!user) {
                return done(null, false, { message: "Incorrect username." });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            
            if (!isMatch){
                return done(null, false, { message: "Incorrect password." });
            }
            return done(null, user);

        } catch (error) {
            return done(error);
        }
    }
));

passport.serializeUser((user, done) => {
    done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: id }
      });
      done(null, user); // Attach the user object to req.user
    } catch (err) {
      done(err);
    }
  });
  