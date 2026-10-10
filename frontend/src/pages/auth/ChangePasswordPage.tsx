import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { errorMessage } from '../../api/client';
import { homePathFor, useAuthStore } from '../../store/useAuthStore';
import { AuthLayout, FormError, inputClass } from './LoginPage';

export const ChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { status, user, changePassword, logout } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status !== 'authenticated' || !user) return <Navigate to="/login" replace />;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (newPassword.length < 10) return setError('New password must be at least 10 characters.');
    if (newPassword !== confirm) return setError('The new passwords do not match.');
    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      navigate(homePathFor(user.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={user.mustChangePassword ? 'Set your own password' : 'Change password'}
      subtitle={
        user.mustChangePassword
          ? 'Your account was created with a temporary password. Choose a new one to continue.'
          : 'Other devices will be signed out.'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        <FormError message={error} />
        <div>
          <label className="block text-gray-300 font-semibold mb-1">Current / temporary password</label>
          <input type="password" autoComplete="current-password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-gray-300 font-semibold mb-1">New password (min. 10 characters)</label>
          <input type="password" autoComplete="new-password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-gray-300 font-semibold mb-1">Confirm new password</label>
          <input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
        </div>
        <Button type="submit" variant="primary" size="md" className="w-full font-bold" disabled={submitting} leftIcon={<KeyRound className="w-4 h-4" />}>
          {submitting ? 'Saving…' : 'Save password'}
        </Button>
        <button type="button" onClick={() => void logout()} className="w-full text-center text-gray-400 hover:text-white">
          Sign out
        </button>
      </form>
    </AuthLayout>
  );
};
