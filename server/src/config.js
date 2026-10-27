import 'dotenv/config';

const required = (name, fallback) => {
  const v = process.env[name] ?? fallback;
  return v;
};

export const config = {
  port: Number(process.env.PORT || 5000),
  env: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  clientUrl: (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, ''),
  mongoUri: required('MONGO_URI', 'mongodb://127.0.0.1:27017/ngfw-tickets'),
  jwtSecret: required('JWT_SECRET', 'dev-only-jwt-secret-change-me'),
  ticketSecret: required('TICKET_SECRET', 'dev-only-ticket-secret-change-me'),
  paystackSecret: process.env.PAYSTACK_SECRET_KEY || '',
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'Nigeria Gala Fashion Week <no-reply@example.com>',
  },
  seed: {
    adminName: process.env.ADMIN_NAME || 'Platform Admin',
    adminEmail: (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase(),
    adminPassword: process.env.ADMIN_PASSWORD || 'ChangeThisAdminPassword1',
    hostName: process.env.HOST_NAME || 'NGFW Host',
    hostEmail: (process.env.HOST_EMAIL || 'host@example.com').toLowerCase(),
    hostPassword: process.env.HOST_PASSWORD || 'ChangeThisHostPassword1',
    platformShare: Number(process.env.PLATFORM_SHARE_PERCENT || 10),
  },
};

export function warnAboutConfig() {
  const warnings = [];
  if (config.jwtSecret.startsWith('dev-only')) warnings.push('JWT_SECRET is not set (using an insecure development default).');
  if (config.ticketSecret.startsWith('dev-only')) warnings.push('TICKET_SECRET is not set (using an insecure development default).');
  if (!config.paystackSecret) warnings.push('PAYSTACK_SECRET_KEY is missing: checkout will not work until you add it.');
  if (!config.smtp.user) warnings.push('SMTP_USER is empty: emails will NOT be sent. Ticket links are printed in this terminal instead.');
  if (config.isProd && (config.jwtSecret.startsWith('dev-only') || config.ticketSecret.startsWith('dev-only'))) {
    throw new Error('Refusing to start in production with default secrets. Set JWT_SECRET and TICKET_SECRET.');
  }
  return warnings;
}
