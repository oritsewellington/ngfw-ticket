import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { Html5Qrcode } from 'html5-qrcode';
import { AlertOctagon, Camera, CameraOff, CheckCircle2, Keyboard, LogOut, ShieldCheck, ShieldX, Wifi, WifiOff, XCircle } from 'lucide-react';
import { errMsg, useManifestQuery, useScanMutation, useScanStatsQuery, useScannerLoginMutation, useSyncScansMutation } from '../store/api';
import { setScannerToken } from '../store/authSlice';
import { act } from '../lib/act';
import { fmtTime } from '../lib/format';
import { Button, Card, Field, Input, Logo, useBusy } from '../components/ui';

/* ---------- tiny safe localStorage helpers (the scanner must never crash if storage is blocked) ---------- */
const read = (k, fallback) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

const RESULT_STYLE = {
  ok: { bg: 'bg-[#0f5f3b]', icon: CheckCircle2, title: 'VALID: LET THEM IN' },
  already_used: { bg: 'bg-[#8a4b05]', icon: AlertOctagon, title: 'ALREADY SCANNED' },
  invalid: { bg: 'bg-[#8e1f1a]', icon: XCircle, title: 'NOT VALID' },
  void: { bg: 'bg-[#8e1f1a]', icon: ShieldX, title: 'TICKET CANCELLED' },
};

function PinScreen() {
  const dispatch = useDispatch();
  const [login] = useScannerLoginMutation();
  const [busy, run] = useBusy();
  const [pin, setPin] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!/^\d{4,8}$/.test(pin)) return toast.error('Enter the 4 to 8 digit PIN from the organisers.');
    return run(async () => {
      const r = await act(login({ pin }), 'Scanner unlocked.');
      if (r) dispatch(setScannerToken(r.token));
    });
  };
  return (
    <div className="grid min-h-dvh place-items-center px-5">
      <div className="w-full max-w-sm text-center">
        <Logo size={56} />
        <h1 className="mt-5 font-display text-3xl font-bold">Gate scanner</h1>
        <p className="mt-2 text-sm text-sand/80">Enter the gate PIN to start checking tickets.</p>
        <Card className="mt-8 p-6">
          <form onSubmit={submit} className="space-y-5">
            <Input inputMode="numeric" autoFocus type="password" maxLength={8} placeholder="••••••" className="text-center font-mono text-2xl tracking-[0.5em]" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
            <Button type="submit" loading={busy} icon={ShieldCheck} className="w-full" size="lg">Unlock</Button>
          </form>
        </Card>
        <Link to="/" className="mt-6 inline-block text-sm text-muted hover:text-sand">← Back to site</Link>
      </div>
    </div>
  );
}

export default function Scanner() {
  const dispatch = useDispatch();
  const { scannerToken, token } = useSelector((s) => s.auth);
  const authed = Boolean(scannerToken || token);

  const [scan] = useScanMutation();
  const [sync] = useSyncScansMutation();
  const { data: manifest } = useManifestQuery(undefined, { skip: !authed, pollingInterval: 90000 });
  const { data: stats } = useScanStatsQuery(undefined, { skip: !authed, pollingInterval: 8000 });

  const [gate, setGate] = useState(() => read('ngfw_gate', 'Gate 1'));
  const [camOn, setCamOn] = useState(false);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [queued, setQueued] = useState(() => read('ngfw_queue', []).length);
  const [result, setResult] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');

  const readerRef = useRef(null);
  const lastRef = useRef({ text: '', at: 0 });
  const lockRef = useRef(false);
  const gateRef = useRef(gate);
  gateRef.current = gate;

  useEffect(() => write('ngfw_gate', gate), [gate]);

  /* Keep a copy of the valid-ticket list on this phone so scanning still works if the venue's internet drops. */
  useEffect(() => {
    if (manifest) write('ngfw_manifest', manifest);
  }, [manifest]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  /* Upload scans made while offline as soon as we're back. */
  const flush = useCallback(async () => {
    const queue = read('ngfw_queue', []);
    if (!queue.length || !navigator.onLine) return;
    try {
      const res = await sync({ scans: queue }).unwrap();
      write('ngfw_queue', []);
      setQueued(0);
      if (res.conflicts?.length) toast.warning(`${res.conflicts.length} offline scan${res.conflicts.length === 1 ? ' was' : 's were'} already used elsewhere: ${res.conflicts.map((c) => c.attendeeName).join(', ')}.`, { duration: 12000 });
      else toast.success(`Uploaded ${res.applied} scan${res.applied === 1 ? '' : 's'} made while offline.`);
    } catch (e) {
      if (e.status !== 'FETCH_ERROR') toast.error(errMsg(e));
    }
  }, [sync]);

  useEffect(() => {
    if (!authed) return;
    if (online) flush();
    const id = setInterval(flush, 20000);
    return () => clearInterval(id);
  }, [authed, online, flush]);

  const offlineCheck = (text, manual) => {
    const list = read('ngfw_manifest', null);
    if (!list) return { result: 'invalid', message: "You're offline and this phone hasn't downloaded the guest list yet. Connect once to load it." };
    const usedLocal = new Set(read('ngfw_used', []));
    const hit = list.tickets.find((t) => (manual ? t.code === text.trim().toUpperCase() : t.qr === text.trim()));
    if (!hit) return { result: 'invalid', message: 'Not found in the offline guest list. Check the code, or try again when online.' };
    if (usedLocal.has(hit.code)) return { result: 'already_used', message: 'This ticket was already scanned on this phone.', ticket: hit };
    usedLocal.add(hit.code);
    write('ngfw_used', [...usedLocal]);
    const queue = read('ngfw_queue', []);
    queue.push({ code: hit.code, at: new Date().toISOString(), gate: gateRef.current });
    write('ngfw_queue', queue);
    setQueued(queue.length);
    return { result: 'ok', message: 'Valid (offline). Will sync automatically.', ticket: hit, offline: true };
  };

  const show = (r) => {
    setResult(r);
    try { navigator.vibrate?.(r.result === 'ok' ? 80 : [160, 80, 160]); } catch { /* not supported */ }
  };

  const handle = async (text, manual = false) => {
    const now = Date.now();
    if (!manual && lastRef.current.text === text && now - lastRef.current.at < 4000) return;
    lastRef.current = { text, at: now };
    if (lockRef.current) return;
    lockRef.current = true;
    try {
      const res = await scan({ payload: text, manual, gate: gateRef.current }).unwrap();
      show(res);
    } catch (e) {
      if (e.status === 'FETCH_ERROR') show(offlineCheck(text, manual));
      else {
        toast.error(errMsg(e));
        lockRef.current = false;
      }
    }
  };
  const handleRef = useRef(handle);
  handleRef.current = handle;

  const dismiss = () => {
    setResult(null);
    lockRef.current = false;
  };
  useEffect(() => {
    if (result?.result !== 'ok') return;
    const id = setTimeout(dismiss, 2200);
    return () => clearTimeout(id);
  }, [result]);

  /* Camera */
  const stopCam = useCallback(async () => {
    const r = readerRef.current;
    readerRef.current = null;
    if (r) {
      try { if (r.isScanning) await r.stop(); r.clear(); } catch { /* already stopped */ }
    }
    setCamOn(false);
  }, []);

  const startCam = async () => {
    try {
      const reader = new Html5Qrcode('reader');
      readerRef.current = reader;
      await reader.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } }, (text) => handleRef.current(text, false), () => {});
      setCamOn(true);
    } catch {
      readerRef.current = null;
      toast.error("We couldn't open the camera. Allow camera access in your browser settings, or type the ticket code instead.");
    }
  };
  useEffect(() => () => { stopCam(); }, [stopCam]);

  const submitManual = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return toast.error('Type the ticket code first, like NGFW-AB12-CD34.');
    handle(manualCode, true);
    setManualCode('');
    setManualOpen(false);
  };

  if (!authed) return <PinScreen />;
  const style = result && RESULT_STYLE[result.result];

  return (
    <div className="mx-auto min-h-dvh max-w-xl px-4 pb-10 pt-5">
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3"><Logo size={32} /><div className="leading-tight"><p className="text-[9px] tracking-[0.4em] text-gold">NGFW</p><p className="font-display text-lg font-bold">Gate scanner</p></div></div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${online ? 'border-ok/40 text-ok' : 'border-warn/50 text-warn'}`}>{online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />} {online ? 'Online' : 'Offline'}</span>
          <button aria-label="Lock scanner" onClick={() => { stopCam(); dispatch(setScannerToken(null)); toast.success('Scanner locked.'); }} className="cursor-pointer rounded-lg p-2 text-muted hover:text-ivory"><LogOut className="size-5" /></button>
        </div>
      </header>

      <div className="mb-4 grid grid-cols-3 gap-3 text-center">
        <Card className="p-3"><p className="font-display text-2xl tabular-nums text-ok">{stats?.used ?? '–'}</p><p className="text-[10px] uppercase tracking-wider text-muted">Checked in</p></Card>
        <Card className="p-3"><p className="font-display text-2xl tabular-nums">{stats?.valid ?? '–'}</p><p className="text-[10px] uppercase tracking-wider text-muted">Still to come</p></Card>
        <Card className="p-3"><p className="font-display text-2xl tabular-nums text-warn">{queued}</p><p className="text-[10px] uppercase tracking-wider text-muted">Waiting to sync</p></Card>
      </div>

      <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-gold/30 bg-ink-2">
        <div id="reader" className="absolute inset-0" />
        {!camOn && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div><Camera className="mx-auto size-12 text-gold" /><p className="mt-4 text-sand">Point the camera at a guest's QR code.</p><Button className="mt-5" size="lg" icon={Camera} onClick={startCam}>Start camera</Button></div>
          </div>
        )}
        {camOn && <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-gold/70" />}
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto] gap-3">
        <Field label="This gate's name"><Input value={gate} onChange={(e) => setGate(e.target.value.slice(0, 24))} placeholder="Gate 1" /></Field>
        <div className="flex items-end gap-2">
          {camOn && <Button variant="outline" icon={CameraOff} onClick={stopCam}>Stop</Button>}
          <Button variant="outline" icon={Keyboard} onClick={() => setManualOpen((o) => !o)}>Type code</Button>
        </div>
      </div>

      <AnimatePresence>
        {manualOpen && (
          <motion.form initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} onSubmit={submitManual} className="mt-3 flex gap-2 overflow-hidden">
            <Input autoFocus className="font-mono uppercase" placeholder="NGFW-AB12-CD34" value={manualCode} onChange={(e) => setManualCode(e.target.value.toUpperCase())} />
            <Button type="submit">Check</Button>
          </motion.form>
        )}
      </AnimatePresence>

      {stats?.recent?.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-[11px] font-semibold tracking-[0.3em] text-muted">LAST CHECKED IN</h2>
          <ul className="space-y-2">
            {stats.recent.map((t) => (
              <li key={t.code + t.usedAt} className="flex items-center justify-between rounded-xl border border-line bg-ink-2 px-4 py-3 text-sm">
                <span className="flex items-center gap-2"><i className="size-2.5 rounded-full" style={{ background: t.tierColor }} /><span className="text-ivory">{t.attendeeName}</span><span className="text-xs text-muted">{t.tierName}</span></span>
                <span className="text-xs text-muted">{fmtTime(t.usedAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AnimatePresence>
        {result && style && (
          <motion.div key="result" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 px-6 text-center text-white ${style.bg}`} onClick={dismiss}>
            <motion.div initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}><style.icon className="size-28" strokeWidth={1.5} /></motion.div>
            <h2 className="font-display text-4xl font-extrabold tracking-wide">{style.title}</h2>
            {result.ticket && (
              <div className="rounded-2xl bg-black/25 px-8 py-5">
                <p className="text-3xl font-bold [overflow-wrap:anywhere]">{result.ticket.attendeeName}</p>
                {result.ticket.tierName && <p className="mt-2 inline-block rounded-full bg-white/90 px-4 py-1 text-xs font-bold tracking-[0.25em] text-black">{String(result.ticket.tierName).toUpperCase()}</p>}
                <p className="mt-2 font-mono text-sm opacity-80">{result.ticket.code}</p>
              </div>
            )}
            <p className="max-w-sm text-lg opacity-95">{result.message}</p>
            {result.result === 'already_used' && result.usedAt && <p className="text-sm opacity-90">First scanned at {fmtTime(result.usedAt)}{result.usedGate ? ` · ${result.usedGate}` : ''}</p>}
            <Button variant="outline" size="lg" className="mt-4 border-white/60 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={(e) => { e.stopPropagation(); dismiss(); }}>Scan next</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
