// A tiny in-memory cache shared by every visitor.
//  - Many people asking for the same thing at the same moment cause ONE database query, not hundreds.
//  - Failures are never cached, so a temporary database hiccup doesn't stick around.
const store = new Map();

export function cached(key, ttlMs, loader) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.promise;

  const promise = Promise.resolve().then(loader);
  store.set(key, { expires: now + ttlMs, promise });
  promise.catch(() => {
    if (store.get(key)?.promise === promise) store.delete(key);
  });
  return promise;
}

/** Forget cached values whose key starts with the prefix (used after the host or admin changes something). */
export function bust(prefix = "") {
  for (const key of store.keys()) if (key.startsWith(prefix)) store.delete(key);
}
