// lib/auth.router.js

import express from "express";
import passport from "passport";
const router = express.Router();

export const genius = (req, res) => {
  console.log("USER HAS AUTHENTICATED!", req.user);
  const io = req.app.get("io");

  // const user = {
  //   name: req.user.username,
  //   photo: req.user.photos[0].value
  // };
  io.in(req.session.socketId).emit("genius", user);
};

// Setting up the passport middleware for each of the OAuth providers
const geniusAuth = passport.authenticate("oauth2", { scope: ["me"] });

// This custom middleware allows us to attach the socket id to the session.
// With the socket id attached we can send back the right user info to
// the right socket
const addSocketIdtoSession = (req, res, next) => {
  console.log("addSocketIdtoSession");
  req.session.socketId = req.query.socketId;
  next();
};

// Routes that are triggered by the React client
router.get("/authorize/genius", addSocketIdtoSession, geniusAuth);

// Routes that are triggered by callbacks from OAuth providers once
// the user has authenticated successfully

router.get("/genius/callback", geniusAuth, genius);

export default router;
