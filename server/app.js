import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import logger from "morgan";
import indexRouter from "./routes/index";
import usersRouter from "./routes/users";
import session from "express-session";
import dotenv from "dotenv";
dotenv.config();
const app = express();
/**
 * This app was created using this amazing tutorial: https://www.freecodecamp.org/news/how-to-enable-es6-and-beyond-syntax-with-node-and-express-68d3e11fe1ab/
 */
app.use(
  session({
    secret: "jordansreallygoodsecret", //TO-DO: Use an env variable
    resave: false,
    saveUninitialized: true
  })
);
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "../public")));
app.use("/", indexRouter);
app.use("/users", usersRouter);

export default app;
