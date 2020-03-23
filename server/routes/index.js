import express from "express";
import axios from "axios";
const router = express.Router();
const credentials = {
  client: {
    id: process.env.CLIENT_ID,
    secret: process.env.CLIENT_SECRET
  },
  auth: {
    tokenHost: "https://api.genius.com",
    tokenPath: "/oauth/authorize"
  }
};
const oauth2 = require("simple-oauth2").create(credentials); //TO-D0: Get rid of this unecessary dependency
const appRootUrl =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://glacial-castle-81952.herokuapp.com";

const redirect_uri = `${appRootUrl}/getAccessToken`;
async function authorize(req, res, next) {
  const authorizationUri = oauth2.authorizationCode.authorizeURL({
    client_id: process.env.CLIENT_ID,
    redirect_uri,
    scope: "me",
    response_type: "code"
    // state: '<state>'
  });
  // Redirect example using Express (see http://expressjs.com/api.html#res.redirect)
  res.redirect(authorizationUri);
  console.log("******************AFTER THE REDIRECT");
  //not sure what to do here.
}

async function getAccessToken(req, res, next) {
  const { query } = req;
  const { code } = query;
  axios({
    method: "post",
    url: `https://api.genius.com/oauth/token`,
    headers: {
      accept: "application/json"
    },
    data: {
      code,
      client_secret: process.env.CLIENT_SECRET,
      grant_type: "authorization_code",
      client_id: process.env.CLIENT_ID,
      redirect_uri,
      response_type: "code"
    }
  }).then(response => {
    console.log("Access Token");
    req.session.accessToken = response.data.access_token;
    res.redirect("/search?q=tupac");
    console.log("after the access token");
  });
}

async function search(req, res, next) {
  const { query } = req;
  const { q } = query;
  const { accessToken } = req.session;
  if (!accessToken) {
    res.write(`<a href="/authorize">Sign in first</a>`);
  }
  axios({
    method: "get",
    url: `https://api.genius.com/search`,
    headers: {
      accept: "application/json",
      // host: "api.genius.com",
      authorization: `Bearer ${accessToken}`
    },
    params: {
      q
    }
  })
    .then(response => {
      const { data } = response;
      res.send(data);
    })
    .catch(err => {
      console.log("SEARCH CALL FAILED!!!", err);
      res.redirect("/authorize");
    });
}

const views = (req, res, next) => {
  if (req.session.views) {
    req.session.views++;
    res.setHeader("Content-Type", "text/html");
    res.write("<p>views: " + req.session.views + "</p>");
    res.write("<p>expires in: " + req.session.cookie.maxAge / 1000 + "s</p>");
    res.end();
  } else {
    req.session.views = 1;
    res.end("welcome to the session demo. refresh!");
  }
};

/* GET home page. */
router.get("/authorize", authorize);
router.get("/getAccessToken", getAccessToken);
router.get("/search", search);
router.get("/views", views);
export default router;
