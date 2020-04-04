/**
 * This app was created using this amazing tutorial: https://www.freecodecamp.org/news/how-to-enable-es6-and-beyond-syntax-with-node-and-express-68d3e11fe1ab/
 */
import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import passport from "passport";
import cookieParser from "cookie-parser";
import logger from "morgan";
import indexRouter from "./routes/index";
import usersRouter from "./routes/users";
import session from "express-session";
import dotenv from "dotenv";
import passportInit from "./passportInit";
import authRouter from "./routes/auth";
const app = express();
//env variables
dotenv.config();

// Accept requests from the client
app.use(
  cors({
    origin: "http://localhost:3000", //TO-DO: Use env vars to distinguish b/t dev & prod
  })
);

//Set up for express-session
app.use(
  session({
    secret: "jordansreallygoodsecret", //TO-DO: Use an env variable
    resave: true,
    saveUninitialized: true,
    //TO-DO: Should I use genId here?
  })
);

//passport initialization
app.use(passport.initialize());
app.use(passport.session());
passportInit();
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "../public")));
app.use("/", authRouter);
app.use("/", indexRouter);
app.use("/users", usersRouter);

export default app;
