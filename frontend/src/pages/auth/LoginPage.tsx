import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Radio, LogIn, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { errorMessage } from '../../api/client';
import { homePathFor, useAuthStore } from '../../store/useAuthStore';

export const AuthLayout: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  children,
}) => (
  <div className="min-h-screen bg-ops-base flex items-center justify-center p-4 text-gray-100">
    <div className="w-full max-w-sm bg-ops-panel border border-ops-border rounded-2xl shadow-2xl p-6 space-y-5">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-teal to-emerald-500 flex items-center justify-center text-ops-base">
          <Radio className="w-5 h-5 stroke-[2.5]" />
        </div>
        <div>
          <div className="font-extrabold text-base tracking-tight text-white">FIELDTRACE</div>
          <div className="text-[10px] text-gray-400 tracking-wider font-mono">OPERATIONS CONSOLE</div>
        </div>
      </div>
      <div>
        <h1 className="text-lg font-bold text-white">{title}</h1>
        <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
      </div>
      {children}
    </div>
  </div>
);

export const inputClass =
  'w-full bg-ops-card border border-ops-border rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-teal';

export const FormError: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <div className="p-2.5 bg-rose-950/50 border border-rose-500/50 rounded-lg text-rose-300 text-xs flex items-center gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span>{message}</span>
    </div>
  ) : null;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { status, user, login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated' && user) {
    return <Navigate to={user.mustChangePassword ? '/change-password' : homePathFor(user.role)} replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const signedIn = await login(email.trim(), password);
      const from = (location.state as { from?: string } | null)?.from;
      const target = signedIn.mustChangePassword ? '/change-password' : from ?? homePathFor(signedIn.role);
      navigate(target, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Sign in" subtitle="Managers and admins open the operations dashboard; field agents open the driver app.">
      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        <FormError message={error} />
        <div>
          <label className="block text-gray-300 font-semibold mb-1">Email</label>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-gray-300 font-semibold mb-1">Password</label>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          size="md"
          className="w-full font-bold"
          disabled={submitting}
          leftIcon={<LogIn className="w-4 h-4" />}
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  );
};
