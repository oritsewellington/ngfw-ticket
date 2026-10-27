// One command to get ready:  npm run setup
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (label, cmd, cwd) => {
  console.log(`\n▶ ${label}`);
  const r = spawnSync(cmd, { cwd, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    console.error(`\n✖ "${label}" failed. Check your internet connection and try again.`);
    process.exit(1);
  }
};

const major = Number(process.versions.node.split('.')[0]);
if (major < 18) {
  console.error(`✖ Node.js 18 or newer is required (you have ${process.versions.node}). Download the LTS version from https://nodejs.org`);
  process.exit(1);
}

run('Installing root tools', 'npm install', root);
run('Installing server packages', 'npm install', path.join(root, 'server'));
run('Installing client packages', 'npm install', path.join(root, 'client'));

const envPath = path.join(root, 'server', '.env');
if (!fs.existsSync(envPath)) {
  const secret = () => crypto.randomBytes(48).toString('hex');
  let env = fs.readFileSync(path.join(root, 'server', '.env.example'), 'utf8');
  env = env.replace('JWT_SECRET=change-me-to-a-long-random-string', `JWT_SECRET=${secret()}`).replace('TICKET_SECRET=change-me-to-another-long-random-string', `TICKET_SECRET=${secret()}`);
  fs.writeFileSync(envPath, env);
  console.log('\n✔ Created server/.env with fresh random secrets');
} else {
  console.log('\n✔ server/.env already exists (left untouched)');
}

console.log(`
──────────────────────────────────────────────
 Almost there. Now:
  1. Open server/.env and set:
       MONGO_URI            (local MongoDB or a free Atlas URL)
       PAYSTACK_SECRET_KEY  (sk_test_... from dashboard.paystack.com)
       ADMIN_EMAIL / ADMIN_PASSWORD / HOST_EMAIL / HOST_PASSWORD
       SMTP_USER / SMTP_PASS (optional: Gmail App Password)
  2. Start everything:   npm run dev
  3. Open http://localhost:5173
──────────────────────────────────────────────`);
