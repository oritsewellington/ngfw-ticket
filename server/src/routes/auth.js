import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { User } from '../models/index.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { audit } from '../lib/audit.js';
import { isEmail } from '../lib/validate.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many sign-in attempts. Please wait a few minutes and try again.', code: 'rate_limited' },
});

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!isEmail(email) || !password) throw new AppError('Please enter your email and password.', 400, 'validation');
    const user = await User.findOne({ email });
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) throw new AppError('Incorrect email or password.', 401, 'bad_credentials');
    await audit({ name: user.name, role: user.role }, 'sign_in', '');
    res.json({
      token: signToken({ sub: String(user._id), role: user.role, name: user.name }),
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  })
);

router.get(
  '/me',
  requireAuth('admin', 'host'),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) throw new AppError('Please sign in to continue.', 401, 'unauthorized');
    res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  })
);

router.post(
  '/change-password',
  requireAuth('admin', 'host'),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 8) throw new AppError('Your new password must be at least 8 characters long.', 400, 'validation');
    const user = await User.findById(req.user.id);
    if (!user || !(await bcrypt.compare(String(currentPassword || ''), user.passwordHash))) {
      throw new AppError('Your current password is not correct.', 400, 'bad_credentials');
    }
    user.passwordHash = await bcrypt.hash(String(newPassword), 12);
    await user.save();
    await audit(req.user, 'password_changed', '');
    res.json({ message: 'Password updated.' });
  })
);

export default router;
