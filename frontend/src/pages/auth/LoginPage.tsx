import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import { Radio, LogIn, AlertTriangle, Sparkles, ArrowLeft, Shield, UserCheck, Smartphone } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { errorMessage } from '../../api/client';
import { homePathFor, useAuthStore } from '../../store/useAuthStore';

export const AuthLayout: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  children,
}) => (
  <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4 text-stone-900 selection:bg-[#E85D38]/20 selection:text-[#E85D38]">
    {/* Soft ambient background glow */}
    <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-tr from-[#E85D38]/8 to-amber-500/5 blur-3xl pointer-events-none rounded-full" />

    <div className="w-full max-w-md bg-white border border-stone-200/90 rounded-3xl shadow-[0_20px_50px_rgba(28,25,23,0.06)] p-7 sm:p-8 space-y-6 relative z-10">
      <div className="flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#E85D38] to-[#FF8C66] flex items-center justify-center text-white shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
            <Radio className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="font-extrabold text-base tracking-tight text-stone-900">FLEETORA</div>
            <div className="text-[9px] text-[#E85D38] font-bold tracking-wider font-mono">OPERATIONS CONSOLE</div>
          </div>
        </Link>
        <Link
          to="/"
          className="text-xs font-semibold text-stone-500 hover:text-stone-900 flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Home</span>
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-extrabold text-stone-900 tracking-tight">{title}</h1>
        <p className="text-xs text-stone-500 mt-1 leading-relaxed">{subtitle}</p>
      </div>

      {children}
    </div>
  </div>
);

export const inputClass =
  'w-full bg-[#FAF8F5] border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#E85D38] focus:ring-2 focus:ring-[#E85D38]/10 transition-all font-mono';

export const FormError: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
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

  const doLogin = async (loginEmail: string, loginPass: string) => {
    setError(null);
    setSubmitting(true);
    try {
      const signedIn = await login(loginEmail.trim(), loginPass);
      const from = (location.state as { from?: string } | null)?.from;
      const target = signedIn.mustChangePassword ? '/change-password' : from ?? homePathFor(signedIn.role);
      navigate(target, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    doLogin(email, password);
  };

  const handleQuickDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('FieldTrace123!');
    doLogin(demoEmail, 'FieldTrace123!');
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Managers and admins access the dispatch dashboard; field agents open the driver app."
    >
      {/* 1-Click Quick Demo Login Shortcuts */}
      <div className="p-3.5 bg-[#FAF8F5] border border-stone-200/90 rounded-2xl space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#E85D38]" /> 1-Click Demo Logins
          </span>
          <span className="text-[10px] font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            Ready to use
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleQuickDemo('admin@acme.test')}
            disabled={submitting}
            className="p-2.5 rounded-xl bg-white border border-stone-200 hover:border-[#E85D38] shadow-xs text-center transition-all hover:scale-[1.02] cursor-pointer flex flex-col items-center justify-center group"
          >
            <Shield className="w-4 h-4 text-[#E85D38] mb-1 group-hover:scale-110 transition-transform" />
            <p className="text-xs font-bold text-stone-900 leading-tight">Admin</p>
            <p className="text-[9px] text-stone-400 font-mono mt-0.5">Full Console</p>
          </button>
          <button
            type="button"
            onClick={() => handleQuickDemo('manager1@acme.test')}
            disabled={submitting}
            className="p-2.5 rounded-xl bg-white border border-stone-200 hover:border-[#E85D38] shadow-xs text-center transition-all hover:scale-[1.02] cursor-pointer flex flex-col items-center justify-center group"
          >
            <UserCheck className="w-4 h-4 text-blue-600 mb-1 group-hover:scale-110 transition-transform" />
            <p className="text-xs font-bold text-stone-900 leading-tight">Manager</p>
            <p className="text-[9px] text-stone-400 font-mono mt-0.5">North Zone</p>
          </button>
          <button
            type="button"
            onClick={() => handleQuickDemo('agent01@acme.test')}
            disabled={submitting}
            className="p-2.5 rounded-xl bg-white border border-stone-200 hover:border-[#E85D38] shadow-xs text-center transition-all hover:scale-[1.02] cursor-pointer flex flex-col items-center justify-center group"
          >
            <Smartphone className="w-4 h-4 text-emerald-600 mb-1 group-hover:scale-110 transition-transform" />
            <p className="text-xs font-bold text-stone-900 leading-tight">Driver</p>
            <p className="text-[9px] text-stone-400 font-mono mt-0.5">PWA App</p>
          </button>
        </div>
      </div>

      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-stone-200" />
        </div>
        <span className="relative bg-white px-3 text-[11px] font-mono text-stone-400 uppercase">
          Or sign in with email
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
        <FormError message={error} />
        <div>
          <label className="block text-stone-700 font-bold mb-1 font-mono">Email Address</label>
          <input
            type="email"
            autoComplete="username"
            required
            placeholder="admin@acme.test"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-stone-700 font-bold mb-1 font-mono">Password</label>
          <input
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          size="md"
          className="w-full font-bold shadow-md shadow-orange-500/20 py-2.5 text-xs"
          disabled={submitting}
          leftIcon={<LogIn className="w-4 h-4" />}
        >
          {submitting ? 'Signing in…' : 'Sign in to Console'}
        </Button>
      </form>

      {/* Demo Credentials Reference Box */}
      <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 text-[11px] font-mono text-stone-600 space-y-1">
        <div className="flex items-center justify-between font-bold text-stone-800">
          <span>Seeded Demo Credentials</span>
          <span className="text-[#E85D38]">PW: FieldTrace123!</span>
        </div>
        <p className="text-stone-500 text-[10px]">
          • Admin: <code className="text-stone-800 font-bold">admin@acme.test</code><br />
          • Manager: <code className="text-stone-800 font-bold">manager1@acme.test</code><br />
          • Driver: <code className="text-stone-800 font-bold">agent01@acme.test</code>
        </p>
      </div>
    </AuthLayout>
  );
};
