// lib/passport.init.js

import passport from "passport";
import OAuth2Strategy from "passport-oauth2";
import User from './db/models/User';
const passportInit = () => {
  // Allowing passport to serialize and deserialize users into sessions
  passport.serializeUser((user, done) => {
    console.log("serializeUser", { user })
    return done(null, user.id)
  });
  passport.deserializeUser((id, done) => {
    console.log("deserializeUser", { id })
    User.findById(id, (err, user) => {
      if (err) {
        console.log("no user", err)
        return done(err);
      } else {
        console.log("user", user)
        return done(null, user)
      }
    })
  })
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
  const OAuth2Config = {
    authorizationURL: "https://api.genius.com/oauth/authorize",
    tokenURL: "https://api.genius.com/oauth/token",
    clientID: client_id,
    clientSecret: client_secret,
    callbackURL: redirect_uri,
    scope: "me",
  };

  // The function that is called when an OAuth provider sends back user
  // information.  Normally, you would save the user to the database here
  // in a callback that was customized for each provider.
  //TO-DO: This callback currently doesn't get called. When it did, it seemed to have accessToken/accessCode in it.
  //...did I do something wrong?
  const callback = (accessToken, refreshToken, profile, cb) => {
    console.log("PASSPORT CALLBACK", {
      accessToken,
      refreshToken,
      profile,
      cb,
    });
    const result = cb(null, accessToken);
    console.log("result", result);
    return result;
  };

  // Adding each OAuth provider's strategy to passport
  passport.use(new OAuth2Strategy(OAuth2Config, callback));
  console.log("Passport Initialized!");
};
export default passportInit;
