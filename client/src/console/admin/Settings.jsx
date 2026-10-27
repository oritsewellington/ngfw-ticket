import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, Percent, Save, UserCog } from 'lucide-react';
import { errMsg, useChangePasswordMutation, useHostAccountMutation, usePatchSettingsMutation, useSettingsQuery } from '../../store/api';
import { act } from '../../lib/act';
import { isEmail } from '../../lib/format';
import { Badge, Button, Card, ErrorState, Field, Input, Skeleton, useBusy } from '../../components/ui';
import { PageHeader } from '../ConsoleLayout';

export default function Settings() {
  const { data, error, refetch } = useSettingsQuery();
  const [patch] = usePatchSettingsMutation();
  const [hostAcc] = useHostAccountMutation();
  const [changePw] = useChangePasswordMutation();
  const [b1, run1] = useBusy();
  const [b2, run2] = useBusy();
  const [b3, run3] = useBusy();
  const [pct, setPct] = useState('');
  const [host, setHost] = useState({ name: '', email: '', password: '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });

  useEffect(() => {
    if (!data) return;
    setPct(String(data.platformSharePercent));
    if (data.host) setHost((h) => ({ ...h, name: data.host.name, email: data.host.email }));
  }, [data]);

  if (error) return <ErrorState message={errMsg(error)} onRetry={refetch} />;
  if (!data) return <Skeleton className="h-96" />;

  const savePct = () => {
    const n = Number(pct);
    if (!Number.isFinite(n) || n < 0 || n > 100) return toast.error('The platform share must be between 0 and 100.');
    return run1(() => act(patch({ platformSharePercent: n }), `Platform share is now ${n}%. It applies to future payments only.`));
  };
  const saveHost = () => {
    if (host.name.trim().length < 2) return toast.error("Please enter the host's name.");
    if (!isEmail(host.email)) return toast.error("Please enter the host's email address.");
    if (host.password && host.password.length < 8) return toast.error('The new password must be at least 8 characters.');
    return run2(async () => {
      const r = await act(hostAcc(host), 'Host account updated.');
      if (r) setHost((h) => ({ ...h, password: '' }));
    });
  };
  const savePw = () => {
    if (!pw.currentPassword) return toast.error('Please enter your current password.');
    if (pw.newPassword.length < 8) return toast.error('Your new password must be at least 8 characters.');
    return run3(async () => {
      const r = await act(changePw(pw), 'Your password has been changed.');
      if (r) setPw({ currentPassword: '', newPassword: '' });
    });
  };

  const sys = data.system;
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" sub="Platform share, host login and system connections." />

      <Card className="p-6">
        <h2 className="flex items-center gap-2 font-display text-2xl"><Percent className="size-5 text-gold" /> Platform share</h2>
        <p className="mt-2 text-sm text-muted">Your percentage of <strong className="text-sand">net revenue</strong> (what's left after Paystack fees). The host receives the rest. Changing this only affects future payments, and every past payment keeps the percentage it was made with. The change is recorded in the activity log the host can see.</p>
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <Field label="Platform %" className="w-40"><Input type="number" min="0" max="100" step="0.5" value={pct} onChange={(e) => setPct(e.target.value)} /></Field>
          <Button icon={Save} loading={b1} onClick={savePct}>Save</Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="flex items-center gap-2 font-display text-2xl"><UserCog className="size-5 text-gold" /> Host account</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Name"><Input value={host.name} onChange={(e) => setHost({ ...host, name: e.target.value })} /></Field>
          <Field label="Email (their login)"><Input type="email" value={host.email} onChange={(e) => setHost({ ...host, email: e.target.value })} /></Field>
          <Field label="Reset password" hint="Leave blank to keep their current password." className="sm:col-span-2"><Input type="password" autoComplete="new-password" value={host.password} onChange={(e) => setHost({ ...host, password: e.target.value })} placeholder="At least 8 characters" /></Field>
        </div>
        <Button className="mt-5" icon={Save} loading={b2} onClick={saveHost}>Save host account</Button>
      </Card>

      <Card className="p-6">
        <h2 className="flex items-center gap-2 font-display text-2xl"><KeyRound className="size-5 text-gold" /> Change my password</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Current password"><Input type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
          <Field label="New password"><Input type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
        </div>
        <Button className="mt-5" variant="outline" icon={Save} loading={b3} onClick={savePw}>Update password</Button>
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-2xl">System connections</h2>
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex items-center justify-between"><dt className="text-sand">Paystack</dt><dd><Badge tone={sys.paystackMode === 'live' ? 'ok' : sys.paystackMode === 'test' ? 'warn' : 'bad'}>{sys.paystackMode === 'live' ? 'LIVE' : sys.paystackMode === 'test' ? 'TEST MODE' : 'NOT CONNECTED'}</Badge></dd></div>
          <div className="flex items-center justify-between"><dt className="text-sand">Email (Nodemailer)</dt><dd><Badge tone={sys.smtpConfigured ? 'ok' : 'bad'}>{sys.smtpConfigured ? 'CONNECTED' : 'NOT SET: EMAILS NOT SENT'}</Badge></dd></div>
          <div className="flex items-center justify-between gap-4"><dt className="text-sand">Emails sent from</dt><dd className="truncate text-muted">{sys.mailFrom}</dd></div>
          <div className="flex items-center justify-between gap-4"><dt className="text-sand">Website address</dt><dd className="truncate text-muted">{sys.clientUrl}</dd></div>
        </dl>
        <p className="mt-5 text-xs text-muted">Secrets such as the Paystack key and email password live in the server's environment settings and are never shown here.</p>
      </Card>
    </div>
  );
}
