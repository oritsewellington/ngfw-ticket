import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { AppError, asyncHandler } from '../lib/errors.js';

export const signToken = (payload, expiresIn = '12h') => jwt.sign(payload, config.jwtSecret, { expiresIn });

/** Usage: requireAuth('admin') or requireAuth('host','admin'). No roles = any signed-in user. */
export const requireAuth = (...roles) =>
  asyncHandler(async (req, _res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new AppError('Please sign in to continue.', 401, 'unauthorized');
    const payload = jwt.verify(token, config.jwtSecret); // TokenExpired / JsonWebToken errors are mapped to friendly messages
    if (roles.length && !roles.includes(payload.role)) {
      throw new AppError("You don't have permission to do that.", 403, 'forbidden');
    }
    req.user = { id: payload.sub, role: payload.role, name: payload.name };
    next();
  });
