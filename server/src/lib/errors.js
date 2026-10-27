/** An error whose message is safe and friendly to show to a real person. */
export class AppError extends Error {
  constructor(message, status = 400, code = 'bad_request') {
    super(message);
    this.status = status;
    this.code = code;
    this.expose = true;
  }
}

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const notFoundHandler = (req, res) => {
  res.status(404).json({ message: "We couldn't find what you were looking for.", code: 'not_found' });
};

const fieldLabels = {
  email: 'email address',
  buyerEmail: 'email address',
  attendeeEmail: 'email address',
  name: 'name',
  code: 'code',
};

/** Turns ANY error into a safe, human message. Raw database/library text is never sent to the browser. */
export function errorHandler(err, req, res, _next) {
  // 1. Our own friendly errors
  if (err instanceof AppError) {
    return res.status(err.status).json({ message: err.message, code: err.code });
  }

  // 2. Bad JSON body
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'We could not read that request. Please refresh the page and try again.', code: 'bad_json' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ message: 'That request is too large.', code: 'too_large' });
  }

  // 3. Mongoose validation
  if (err?.name === 'ValidationError') {
    const first = Object.values(err.errors || {})[0];
    const label = fieldLabels[first?.path] || first?.path || 'a field';
    return res.status(400).json({ message: `Please check the ${label} and try again.`, code: 'validation' });
  }
  if (err?.name === 'CastError') {
    return res.status(404).json({ message: "We couldn't find what you were looking for.", code: 'not_found' });
  }

  // 4. Duplicate keys
  if (err?.code === 11000) {
    const key = Object.keys(err.keyPattern || err.keyValue || {})[0];
    const friendly = {
      email: 'An account with that email already exists.',
      code: 'That code is already in use. Please choose a different one.',
      name: 'That name is already in use. Please choose a different one.',
    }[key] || 'That already exists. Please use a different value.';
    return res.status(409).json({ message: friendly, code: 'duplicate' });
  }

  // 5. Auth tokens
  if (err?.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'Your session has expired. Please sign in again.', code: 'session_expired' });
  }
  if (err?.name === 'JsonWebTokenError') {
    return res.status(401).json({ message: 'Please sign in to continue.', code: 'unauthorized' });
  }

  // 6. Everything else: log the real reason on the SERVER, give the user a calm generic message
  console.error('[unhandled error]', req.method, req.originalUrl, err);
  return res.status(500).json({
    message: 'Something went wrong on our side. Please try again in a moment. If it keeps happening, contact the organisers.',
    code: 'server_error',
  });
}
