import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import logger from "morgan";
import indexRouter from "./routes/index";
import usersRouter from "./routes/users";
import session from "express-session";
import dotenv from "dotenv";
import connect from "./db";
dotenv.config();
const app = express();
app.use(
  session({
    secret: "jordansreallygoodsecret",
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
