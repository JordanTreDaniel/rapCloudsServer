import express from "express";
import axios from "axios";
const router = express.Router();

async function search(req, res, next) {
  const { query } = req;
  const { q } = query;
  const { headers } = req;
  // const { accessToken } = req.session; //TO-DO: Get access token to be dependably stored in session, so we don't save on User.
  const { authorization: accessToken } = headers;
  if (!accessToken) {
    res.status(401).json({ status: 401, statusText: "Missing access token. Please sign in first" });
    // made a mistake with the line above and this helped me out:
    //https://stackoverflow.com/questions/7042340/error-cant-set-headers-after-they-are-sent-to-the-client
  }

  axios({
    method: "get",
    url: `https://api.genius.com/search`,
    headers: {
      accept: "application/json",
      // host: "api.genius.com",
      authorization: `Bearer ${accessToken}`,
    },
    params: {
      q,
    },
  })
    .then((response) => {
      const { data } = response;
      res.send(data);
    })
    .catch((err) => {
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
router.get("/search", search);
router.get("/views", views);
export default router;
