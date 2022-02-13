const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth2').Strategy;
require('dotenv').config();

passport.use(new GoogleStrategy({
  clientID: '1081604158312-911a19pdi3g5p8r7d09qim4025hss3bm.apps.googleusercontent.com',
  clientSecret: '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',
  callbackURL: "/auth/google/callback",
  passReqToCallback: true,
},

function(request, accessToken, refreshToken, profile, done) {
  return done(null, profile);
}));

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});