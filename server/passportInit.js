// lib/passport.init.js

import passport from "passport";
import OAuth2Strategy from "passport-oauth2";

const passportInit = () => {
  // Allowing passport to serialize and deserialize users into sessions
  passport.serializeUser((user, cb) => cb(null, user));
  passport.deserializeUser((obj, cb) => cb(null, obj));

  // const client_id =
  //   process.env.NODE_ENV === "development"
  //     ? "IYsFoRzFg3TJIrqIKjdZ4Gps5UOSpSYPu1NyMvuVJ81VpO4zPc4_E2mY7YgIv5vu"
  //     : process.env.PROD_CLIENT_ID;
  // const client_secret =
  //   process.env.NODE_ENV === "development"
  //     ? "Y3mCL3sppOI7YauhC6MVJwMklybu2YaQOGeUsbL7eOqgHEIUzGPNWpYuWsGGT1eVN0eVAfqSBhjG6OSmg2j-zQ"
  //     : process.env.PROD_CLIENT_SECRET;

  const client_id =
    "IYsFoRzFg3TJIrqIKjdZ4Gps5UOSpSYPu1NyMvuVJ81VpO4zPc4_E2mY7YgIv5vu";

  const client_secret =
    "Y3mCL3sppOI7YauhC6MVJwMklybu2YaQOGeUsbL7eOqgHEIUzGPNWpYuWsGGT1eVN0eVAfqSBhjG6OSmg2j-zQ";

  const appRootUrl = "http://localhost:3333";
  // const appRootUrl =
  //   process.env.NODE_ENV === "development"
  //     ? "http://localhost:3333"
  //     : "https://rap-clouds-server.herokuapp.com";

  const redirect_uri = `${appRootUrl}/genius/callback`;
  console.log({ client_id, client_secret, appRootUrl });
  const OAuth2Config = {
    authorizationURL: "https://api.genius.com/oauth/authorize",
    tokenURL: "https://api.genius.com/oauth/token",
    clientID: client_id,
    clientSecret: client_secret,
    callbackURL: redirect_uri
  };

  // The function that is called when an OAuth provider sends back user
  // information.  Normally, you would save the user to the database here
  // in a callback that was customized for each provider.
  const callback = (accessToken, refreshToken, profile, cb) => {
    console.log("PASSPORT CALLBACK", {
      accessToken,
      refreshToken,
      profile,
      cb
    });
    return cb(null, profile);
  };

  // Adding each OAuth provider's strategy to passport
  passport.use(new OAuth2Strategy(OAuth2Config, callback));
  console.log("All DONE!!!!!");
};
export default passportInit;

`https://api.genius.com/oauth/authorize?
response_type=code&
client_id=&
redirect_uri=https%3A%2F%2Frap-clouds-server.herokuapp.com%2FgetAccessToken&
scope=me`;
