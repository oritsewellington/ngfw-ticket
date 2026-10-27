import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { LogIn, ShieldCheck } from 'lucide-react';
import { useLoginMutation } from '../store/api';
import { setCredentials } from '../store/authSlice';
import { act } from '../lib/act';
import { isEmail } from '../lib/format';
import { Button, Card, Field, Input, Logo, Page, useBusy } from '../components/ui';

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { token, user } = useSelector((s) => s.auth);
  const [login] = useLoginMutation();
  const [busy, run] = useBusy();
  const [form, setForm] = useState({ email: '', password: '' });

  if (token && user) return <Navigate to={user.role === 'admin' ? '/admin' : '/console'} replace />;

  const submit = (e) => {
    e.preventDefault();
    if (!isEmail(form.email)) return toast.error('Please enter a valid email address.');
    if (!form.password) return toast.error('Please enter your password.');
    return run(async () => {
      const res = await act(login(form), (r) => `Welcome back, ${r.user.name.split(' ')[0]}.`);
      if (res) {
        dispatch(setCredentials(res));
        navigate(res.user.role === 'admin' ? '/admin' : '/console', { replace: true });
      }
    });
  };

  return (
    <div className="grid min-h-dvh place-items-center px-5 py-10">
      <Page className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={56} />
          <h1 className="mt-5 font-display text-3xl font-bold">Organiser sign in</h1>
          <p className="mt-2 text-sm text-sand/80">Manage tickets, sales and the gate.</p>
        </div>
        <Card className="p-6">
          <form onSubmit={submit} className="space-y-5">
            <Field label="Email" required><Input type="email" autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@email.com" /></Field>
            <Field label="Password" required><Input type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" /></Field>
            <Button type="submit" loading={busy} icon={LogIn} className="w-full">Sign in</Button>
          </form>
        </Card>
        <div className="mt-6 flex flex-col items-center gap-3 text-sm text-muted">
          <Link to="/scanner" className="inline-flex items-center gap-2 text-gold hover:underline"><ShieldCheck className="size-4" /> Gate staff? Open the scanner</Link>
          <Link to="/" className="hover:text-sand">← Back to event</Link>
        </div>
      </Page>
    </div>
  );
}
