import passport from 'passport';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import User from '../models/user.model.js';

const configPassport = (app) => {
  // Cấu hình Passport session
  app.use(passport.initialize());

  // Cấu hình JWT Strategy
  const jwtOptions = {
    jwtFromRequest: ExtractJwt.fromExtractors([
      ExtractJwt.fromAuthHeaderAsBearerToken(),
      (req) => {
        if (req && req.cookies) return req.cookies['token'];
        return null;
      },
    ]),
    secretOrKey: process.env.JWT_SECRET,
  };

  passport.use(
    new JwtStrategy(jwtOptions, async (payload, done) => {
      try {
        const user = await User.findById(payload.id).select('-password');
        if (user) {
          return done(null, user);
        }
        return done(null, false);
      } catch (error) {
        return done(error, false);
      }
    })
  );

  // Cấu hình Facebook Strategy
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: process.env.FACEBOOK_CALLBACK_URL,
        profileFields: ['id', 'displayName', 'photos', 'email'],
        enableProof: true, // For improved security
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Tìm user trong database hoặc tạo mới
          let user = await User.findOne({ facebookId: profile.id });

          if (!user && profile.emails && profile.emails[0]) {
            // Tìm xem có tài khoản nào với email này không
            user = await User.findOne({ email: profile.emails[0].value });

            if (user) {
              // Nếu có, liên kết tài khoản
              user.facebookId = profile.id;
              user.authType = 'facebook';
              await user.save();
            }
          }

          if (!user) {
            // Nếu không tìm thấy, tạo tài khoản mới
            const baseUsername = profile.displayName.toLowerCase().replace(/\s+/g, '.') || 'facebook.user';
            let username = baseUsername;
            let counter = 1;

            while (await User.findOne({ username })) {
              username = `${baseUsername}.${counter}`;
              counter++;
            }

            const randomPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);

            user = new User({
              username,
              fullName: profile.displayName,
              email: profile.emails && profile.emails[0] ? profile.emails[0].value : null,
              password: randomPassword,
              facebookId: profile.id,
              authType: 'facebook',
              profilePicture: profile.photos && profile.photos[0] ? profile.photos[0].value : undefined,
            });

            await user.save();
          }

          return done(null, user);
        } catch (error) {
          return done(error, false);
        }
      }
    )
  );

  // Cấu hình Serialize và Deserialize User
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
};

export default configPassport;