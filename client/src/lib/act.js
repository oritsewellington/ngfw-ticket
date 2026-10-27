import { toast } from 'sonner';
import { errMsg } from '../store/api';
import { API } from './format';

/**
 * Runs an RTK Query mutation promise and ALWAYS tells the person what happened with a Sonner toast:
 *   success -> green toast with your message, returns the data
 *   failure -> red toast with a plain-language message (never a database/technical error), returns null
 */
export async function act(promise, success) {
  try {
    const data = await promise.unwrap();
    if (success) toast.success(typeof success === 'function' ? success(data) : success);
    return data;
  } catch (e) {
    toast.error(errMsg(e));
    return null;
  }
}

/** Downloads a file from the API (CSV exports, PDF tickets) and toasts on success or failure. */
export async function download(path, filename, token) {
  const id = toast.loading('Preparing your download...');
  try {
    let res;
    try {
      res = await fetch(`${API}/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    } catch {
      throw new Error("We can't reach the server. Please check your internet connection and try again.");
    }
    if (!res.ok) {
      let msg = '';
      try {
        msg = (await res.json()).message;
      } catch {
        /* not json */
      }
      throw new Error(msg || 'We could not prepare that file. Please try again.');
    }
    saveBlob(await res.blob(), filename);
    toast.success('Download started.', { id });
  } catch (e) {
    toast.error(e.message, { id });
  }
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
