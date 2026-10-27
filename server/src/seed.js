import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { config } from './config.js';
import { Event, Tier, User } from './models/index.js';

const DEFAULT_POLICY = {
  refund:
    'All ticket sales are final. We do not offer refunds or exchanges once a ticket has been bought. The only exceptions are if the event is cancelled by the organisers, or rescheduled to a date you cannot attend. In those cases, contact us and we will make it right.\n\nCan’t make it? You do not lose your seat. Transfer your ticket to someone else for free from your ticket page.',
  transfer:
    'You can transfer any unused ticket to another person for free, from the “Transfer ticket” button on your ticket page. Enter their name and email. They receive a brand-new QR code and your old one stops working immediately. Transfers close 2 hours before the event starts, and each ticket can be transferred up to 2 times.',
  entry:
    'Every ticket has its own QR code and admits one person, once. The first scan wins: if a screenshot is shared and someone else scans it first, the original holder will be refused. Please keep your QR code private. Bring your ticket on your phone (screen brightness up) or printed. Gate staff may ask for ID that matches the name on the ticket. Re-entry is not allowed once a ticket has been scanned.',
};

export async function seed() {
  const notes = [];

  if (!(await User.findOne({ role: 'admin' }))) {
    await User.create({ name: config.seed.adminName, email: config.seed.adminEmail, role: 'admin', passwordHash: await bcrypt.hash(config.seed.adminPassword, 12) });
    notes.push(`Created ADMIN account: ${config.seed.adminEmail}`);
  }
  if (!(await User.findOne({ role: 'host' }))) {
    await User.create({ name: config.seed.hostName, email: config.seed.hostEmail, role: 'host', passwordHash: await bcrypt.hash(config.seed.hostPassword, 12) });
    notes.push(`Created HOST account: ${config.seed.hostEmail}`);
  }

  if (!(await Event.findOne())) {
    const pin = String(crypto.randomInt(100000, 999999));
    await Event.create({
      name: 'Nigeria Gala Fashion Week',
      tagline: 'Redefining fashion through our culture and heritage',
      description:
        'A celebration of Nigerian culture, craftsmanship and style. Walk the red carpet, watch the runway and be part of the night that redefines fashion through our culture and heritage.',
      startsAt: new Date('2026-11-28T11:00:00.000Z'), // 12:00 PM Lagos (WAT, UTC+1)
      venue: 'Voen Mall Film House',
      address: 'Ugbowo, Benin City, Edo State',
      schedule: [
        { label: 'Red Carpet', time: '12:00 PM' },
        { label: 'Main Event', time: '2:00 PM' },
      ],
      heroImage: '/hero.jpg',
      gatePin: pin,
      platformSharePercent: config.seed.platformShare,
      policy: DEFAULT_POLICY,
    });
    notes.push(`Created the event. Gate scanner PIN: ${pin} (change it in the host dashboard)`);
  }

  if ((await Tier.countDocuments()) === 0) {
    // Names and prices come from the client's flyer. Capacities are placeholders: the host edits them in the dashboard.
    const base = ['Entry to Nigeria Gala Fashion Week'];
    await Tier.insertMany([
      { name: 'Royalty', price: 10000000, capacity: 50, color: '#e2b865', sortOrder: 1, perks: base },
      { name: 'Celebrity', price: 2000000, capacity: 150, color: '#e07a5f', sortOrder: 2, perks: base },
      { name: 'Gala', price: 1000000, capacity: 400, color: '#c98b5a', sortOrder: 3, perks: base },
      { name: 'Ball', price: 500000, capacity: 600, color: '#9fb0c4', sortOrder: 4, perks: base },
    ]);
    notes.push('Created ticket tiers: Royalty ₦100,000, Celebrity ₦20,000, Gala ₦10,000, Ball ₦5,000');
  }

  return notes;
}
