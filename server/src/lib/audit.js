import { Audit } from '../models/index.js';

/** Records who did what. Never throws – logging must not break the action being logged. */
export async function audit(actor, action, detail = '') {
  try {
    await Audit.create({
      actorName: actor?.name || 'System',
      actorRole: actor?.role || 'system',
      action,
      detail,
    });
  } catch (err) {
    console.error('[audit] failed to write log', err?.message);
  }
}
