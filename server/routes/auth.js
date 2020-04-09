// lib/auth.router.js

import express from "express";
import passport from "passport";
import axios from "axios";
import User from '../db/models/User';
const router = express.Router();

export const getAccessToken = (req, res) => {
  const { query } = req;
  const { code } = query;
  const client_id =
    process.env.NODE_ENV === "development"
      ? process.env.DEV_CLIENT_ID
      : process.env.PROD_CLIENT_ID;
  const client_secret =
    process.env.NODE_ENV === "development"
      ? process.env.DEV_CLIENT_SECRET
      : process.env.PROD_CLIENT_SECRET;
  const appRootUrl =
    process.env.NODE_ENV === "development"
      ? "http://localhost:3333"
      : "https://rap-clouds-server.herokuapp.com";
  const redirect_uri = `${appRootUrl}/genius/getAccessToken`;
  axios({
    method: "post",
    url: `https://api.genius.com/oauth/token`,
    headers: {
      accept: "application/json",
    },
    data: {
      code,
      client_secret,
      grant_type: "authorization_code",
      client_id,
      redirect_uri,
      response_type: "code",
    },
  })
    .then((response) => {
      //TO-DO: Set up a session store.
      req.session.accessToken = response.data.access_token;
      const getGeniusAccountURL = `${
        process.env.NODE_ENV === "development"
          ? "http://localhost:3333"
          : "https://rap-clouds-server.herokuapp.com"
        }/getGeniusAccount`;
      res.redirect(getGeniusAccountURL);
    })
    .catch((err) => {
      console.log("TOKEN CALL FAILED!", err);
      res.status(500).send(err);
    });
};

const getGeniusAccount = async (req, res, next) => {
  const { accessToken } = req.session;
  if (!accessToken) {
    res.status(401).json({ status: 401, statusText: "Missing access token. Please sign in first" });
  }
  const io = req.app.get("io");
  try {
    const { data } = await axios({
      method: "get",
      url: `https://api.genius.com/account`,
      headers: {
        accept: "application/json",
        // host: "api.genius.com",
        authorization: `Bearer ${accessToken}`,
      },
    })
    if (data) {
      //TO-DO: Save the user & accessToken to a DB here.
      let { user } = data.response;
      let mongooseUser = await User.findOne({ id: user.id }, (err, mongooseUser) => {
        return mongooseUser;
      })
      if (!mongooseUser) {
        mongooseUser = new User(user);
      }
      mongooseUser.accessToken = accessToken;
      mongooseUser.save();
      io.in(req.session.socketId).emit("genius", mongooseUser);
      res.end();
    }
  } catch (err) {
    console.log("ACCOUNT CALL FAILED!!!", err);
    res.redirect("/authorize/genius");
  }

};

router.get("/getGeniusAccount", getGeniusAccount);

// Setting up the passport middleware for each of the OAuth providers
const geniusAuth = passport.authenticate("oauth2");

// This custom middleware allows us to attach the socket id to the session.
// With the socket id attached we can send back the right user info to
// the right socket
const addSocketIdtoSession = (req, res, next) => {
  const { socketId } = req.query;
  req.session.socketId = socketId;
  next();
};

// Routes that are triggered by the React client
router.get("/authorize/genius", addSocketIdtoSession, geniusAuth);

// Routes that are triggered by genius from getAccessToken with token
router.get("/genius/getAccessToken", getAccessToken);

export default router;
