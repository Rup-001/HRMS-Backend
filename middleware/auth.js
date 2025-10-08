const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const User = require('../models/user');

const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || 'your_jwt_secret'
};

passport.use(new JwtStrategy(opts, async (jwt_payload, done) => {
  console.log('JWT Payload:', jwt_payload);
  try {
    const user = await User.findById(jwt_payload.id).select('email role employeeId companyId isActive');
    console.log('User found:', user);
    if (user && user.isActive) {
      return done(null, user);
    }
    console.log('Authentication failed: User not found or inactive');
    return done(null, false);
  } catch (error) {
    console.log('Passport error:', error);
    return done(error, false);
  }
}));

module.exports = passport;