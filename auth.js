const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth2').Strategy;
require('dotenv').config();

passport.use(new GoogleStrategy({
  clientID: '653237617296-j4n76flsbmkoiq5q2ojufbgm06rkdf4d.apps.googleusercontent.com',
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